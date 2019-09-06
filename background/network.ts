import Discovery = require('hyperdiscovery');
import Hyperdrive = require('hyperdrive');
import DatArchiveImpl = require('@sammacbeth/dat-node/lib/dat-archive')
import RandomAccess = require('random-access-idb-mutable-file');
import { keyPair } from 'hypercore-crypto';
import pda = require('pauls-dat-api');
import { CreateOptions, DatArchive } from './dat';

export default class Network {

  SWARM_RESTART_AFTER = 1000 * 60 * 20;

  private drives: Map<string, Hyperdrive> = new Map();
  private swarmingFeeds = new Set<string>();
  private _swarm: Discovery;
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
          const drive = this.drives.get(feed);
          this.swarm.leave(drive.discoveryKey);
          this.swarm.add(drive);
        }
      });
      if (this.swarmingFeeds.size === 0 && this._swarm) {
        // shutdown the swarm if it is not being used
        this._swarm.close();
        this._swarm = null;
        this.connections = {};
      } else if (this.SWARM_RESTART_AFTER !== 0 && this._swarm && Date.now() - this.swarmCreatedAt > this.SWARM_RESTART_AFTER) {
        // recreate the swarm after a specified interval
        console.log('[restart] Restarting swarm, age = ', Date.now() - this.swarmCreatedAt);
        this._swarm.close();
        this._swarm = null;
        this.connections = {};
        this.swarmingFeeds.forEach((feed) => {
          const drive = this.drives.get(feed);
          this.swarm.add(drive);
        });
      }
    }, 60000);
  }

  get swarm() {
    if (!this._swarm) {
      this._swarm = Discovery({});
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
      this.swarmCreatedAt = Date.now();
      ['peer', 'connecting', 'connect-failed', 'handshaking', 'handshake-timeout', 'connection', 'connection-closed', 'error'].forEach((event) => {
        this._swarm.on(event, (v) => console.log(`[${event}]`, v));
      });
    }
    return this._swarm;
  }

  close() {
    this.swarm.close();
  }

  protected async getStorage(key: string): Promise<any> {
    return await RandomAccess.mount({
      name: key,
      storeName: 'data',
    });
  }

  async getHyperdrive(address: string): Promise<Hyperdrive> {
    if (this.drives.has(address)) {
      const drive = this.drives.get(address);
      if (!this.swarmingFeeds.has(address)) {
        this.swarm.add(drive);
        this.swarmingFeeds.add(address);
      }
      return drive
    }
    return this.loadHyperdrive(Buffer.from(address, 'hex'));
  }

  async getArchive(address: string): Promise<DatArchive> {
    const drive = await this.getHyperdrive(address);
    return new DatArchiveImpl({ key: address, dataStructure: drive });
  }

  async createArchive(opts: CreateOptions): Promise<DatArchive> {
    const kp = keyPair();
    const address = kp.publicKey.toString('hex');
    const drive = await this.loadHyperdrive(kp.publicKey, kp.secretKey);
    pda.writeManifest(drive, opts);
    return new DatArchiveImpl({ key: address, dataStructure: drive });
  }

  async forkArchive(addr: string, manifest: CreateOptions): Promise<DatArchive> {
    // load source
    const srcArchive = await this.getHyperdrive(addr);
    // get source manifest
    const srcManifest = await (pda.readManifest(srcArchive).catch(_ => ({})));
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
    const address = kp.publicKey.toString('hex');
    const dstArchive = await this.loadHyperdrive(kp.publicKey, kp.secretKey);
    pda.writeManifest(dstArchive, dstManifest);
    await pda.exportArchiveToArchive({
      srcArchive,
      dstArchive,
      skipUndownloadedFiles: false,
      ignore: ['/.dat', '/.git', '/dat.json'],
    });
    return new DatArchiveImpl({ key: address, dataStructure: dstArchive });;
  }

  closeArchive(key: string): void {
    const drive = this.drives.get(key);
    if (!drive) {
      return;
    }
    if (this.swarmingFeeds.has(key)) {
      this.swarm.leave(key);
      this.swarmingFeeds.delete(key);
    }
    drive.close();
    this.drives.delete(key);
  }

  isSwarming(key: string): boolean {
    return this.swarmingFeeds.has(key);
  }

  private async loadHyperdrive(address: Buffer, secretKey?: Buffer) : Promise<Hyperdrive> {
    const addressStr = address.toString('hex');
    const storage = await this.getStorage(addressStr);
    const drive = new Hyperdrive(storage, address, {
      secretKey,
      sparse: true,
    });
    this.drives.set(addressStr, drive);
    // wait for ready
    await new Promise((resolve, reject) => {
      drive.ready(err => {
        if (err) reject(err)
        else resolve()
      })
    });

    this.swarm.add(drive);
    this.swarmingFeeds.add(addressStr);

    // await initial metadata sync if not the owner
    if (!drive.writable && !drive.metadata.length) {
      // wait to receive a first update
      await new Promise((resolve, reject) => {
        drive.metadata.update(err => {
          if (err) reject(err)
          else resolve()
        })
      })
    }
    if (!drive.writable) {
      // always download all metadata
      drive.metadata.download({start: 0, end: -1})
    }

    return drive;
  }
}