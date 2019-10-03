import Discovery = require('hyperdiscovery');
import WRTCDiscovery = require('@geut/discovery-swarm-webrtc');
import Hyperdrive = require('hyperdrive');
import DatArchiveImpl = require('@sammacbeth/dat-node/lib/dat-archive')
import RandomAccess = require('random-access-idb-mutable-file');
import { keyPair } from 'hypercore-crypto';
import pda = require('pauls-dat-api');
import Dat, { DatManifest, DatArchive } from './dat';
import { EventEmitter } from 'events';

class MultiSwarm extends EventEmitter {
  disc: Discovery;
  wrtc: WRTCDiscovery;

  constructor() {
    super();
    this.disc = Discovery({
      autoListen: false,
    });
    this.disc._port = undefined;
    this.disc.listen();
    this.wrtc = WRTCDiscovery({
      id: this.disc.id,
      bootstrap: ['https://signal.dat-web.eu'],
      stream: this.disc._createReplicationStream.bind(this.disc),
    });
    // reemit events
    ['listening', 'join', 'leave', 'peer', 'connecting', 'connect-failed', 'handshaking',
    'handshake-timeout', 'connection', 'connection-closed', 'error']
    .forEach((event) => {
      this.disc.on(event, (...args) => {
        console.log(`[${event}]`, args);
        this.emit(event, ...args);
      });
    });
    ['peer', 'connection', 'connection-closed', 'candidates'].forEach((event) => {
      this.wrtc.on(event, (...args) => {
        console.log(`[wrtc_${event}]`, args);
        this.emit(event, ...args);
      });
    });
  }

  add(drive: Hyperdrive) {
    this.disc.add(drive);
    this.wrtc.join(drive.discoveryKey);
  }

  leave(discoveryKey: Buffer) {
    this.disc.leave(discoveryKey);
    this.wrtc.leave(discoveryKey);
  }

  close() {
    this.disc.close();
    this.wrtc.close();
  }
}

export default class Network {

  SWARM_RESTART_AFTER = 1000 * 60 * 20;

  private dats: Map<string, Dat> = new Map();
  private _swarm: MultiSwarm;
  private connections: { [key: string]: number } = {};
  private swarmCreatedAt: number;

  constructor() {
    setInterval(() => {
      // manage connections to swarms
      this.swarmingFeeds.forEach((feed) => {
        const nConnections = this.connections[feed];
        if (!nConnections) {
          // no peers, reconnect
          console.log('[reconnect] No more connections for', feed);
          const dat = this.dats.get(feed);
          dat.leaveNetwork();
          dat.joinNetwork();
        }
      });
      if (this.swarmingFeeds.length === 0 && this._swarm) {
        // shutdown the swarm if it is not being used
        this.close();
      } else if (this.SWARM_RESTART_AFTER !== 0 && this._swarm && Date.now() - this.swarmCreatedAt > this.SWARM_RESTART_AFTER) {
        // recreate the swarm after a specified interval
        console.log('[restart] Restarting swarm, age = ', Date.now() - this.swarmCreatedAt);
        this.close();

        // reopen dats
        this.swarmingFeeds.forEach((feed) => {
          this.getDat(feed);
        });
      }
    }, 300000);
  }

  get swarm() {
    if (!this._swarm) {
      this._swarm = new MultiSwarm();
      this._swarm.on('connection', ({ key }) => {
        const keyStr = key.toString('hex');
        if (!this.connections[keyStr]) {
          this.connections[keyStr] = 0;
        }
        this.connections[keyStr] += 1;
      });
      this._swarm.on('connection-closed', ({ key }) => {
        const keyStr = key.toString('hex');
        if (this.connections[keyStr]) {
          this.connections[keyStr] -= 1;
        }
      });
      this._swarm.on('join', ({ key }) => {
        if (this.dats.has(key)) {
          this.dats.get(key).isSwarming = true;
        }
      });
      this._swarm.on('leave', ({ key }) => {
        if (this.dats.has(key)) {
          this.dats.get(key).isSwarming = false;
        }
      });
      this.swarmCreatedAt = Date.now();
    }
    return this._swarm;
  }

  get swarmingFeeds(): string[] {
    const keys = [];
    for (const [key, dat] of this.dats.entries()) {
      if (dat.isSwarming) {
        keys.push(key);
      }
    }
    return keys;
  }

  close() {
    for (const dat of this.dats.values()) {
      dat.close();
    }
    this.dats.clear();
    this.swarm.close();
    this._swarm = null;
    this.connections = {};
  }

  protected async getStorage(key: string): Promise<any> {
    return await RandomAccess.mount({
      name: key,
      storeName: 'data',
    });
  }

  async getDat(address: string, autoSwarm = true): Promise<Dat> {
    if (this.dats.has(address)) {
      const dat = this.dats.get(address);
      if (!dat.isSwarming && autoSwarm) {
        await dat.joinNetwork()
      }
      return dat
    }
    const dat = await this.loadDat(Buffer.from(address, 'hex'));
    if (autoSwarm) {
      try {
        await dat.joinNetwork();
      } catch (e) {
        this.dats.delete(address);
      }
    }
    return dat;
  }

  async getArchive(address: string): Promise<DatArchive> {
    const dat = await this.getDat(address);
    return dat.archive;
  }

  async createDat(opts: DatManifest): Promise<Dat> {
    const kp = keyPair();
    const dat = await this.loadDat(kp.publicKey, kp.secretKey);
    pda.writeManifest(dat.drive, opts);
    await dat.joinNetwork();
    return dat;
  }

  async forkDat(addr: string, manifest: DatManifest): Promise<Dat> {
    // load source
    const srcDat = await this.getDat(addr);
    // get source manifest
    const srcManifest = await (pda.readManifest(srcDat.drive).catch(_ => ({})));
    // override any manifest data
    const dstManifest = {
      title: (manifest.title) ? manifest.title : srcManifest.title,
      description: (manifest.description) ? manifest.description : srcManifest.description,
      type: (manifest.type) ? manifest.type : srcManifest.type
    };
    ['web_root', 'fallback_page', 'links'].forEach(field => {
      if (srcManifest[field]) {
        dstManifest[field] = srcManifest[field]
      }
    });
    // create the new archive
    const kp = keyPair();
    const dstDat = await this.loadDat(kp.publicKey, kp.secretKey);
    pda.writeManifest(dstDat.archive, dstManifest);
    await pda.exportArchiveToArchive({
      srcArchive: srcDat.drive,
      dstArchive: dstDat.drive,
      skipUndownloadedFiles: false,
      ignore: ['/.dat', '/.git', '/dat.json'],
    });
    return dstDat;
  }

  async closeArchive(key: string): Promise<void> {
    const dat = this.dats.get(key);
    if (!dat) {
      return;
    }
    this.dats.delete(key);
    return new Promise(resolve => {
      dat.drive.once('close', resolve);
      dat.close();
    });
  }

  async deleteArchive(key: string): Promise<void> {
    await this.closeArchive(key);
    window.indexedDB.deleteDatabase(key);
  }

  isSwarming(key: string): boolean {
    return this.dats.has(key) && this.dats.get(key).isSwarming;
  }

  private async loadDat(address: Buffer, secretKey?: Buffer) : Promise<Dat> {
    const addressStr = address.toString('hex');
    const storage = await this.getStorage(addressStr);
    const drive = new Hyperdrive(storage, address, {
      secretKey,
      sparse: true,
    });
    // wait for ready
    await new Promise((resolve, reject) => {
      drive.ready(err => {
        if (err) reject(err)
        else resolve()
      })
    });
    const dat = new Dat(drive, this.swarm);
    this.dats.set(addressStr, dat);

    return dat;
  }
}