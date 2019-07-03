import * as Discovery from 'hyperdiscovery';
import * as Hyperdrive from 'hyperdrive';
import * as DatArchiveImpl from '@sammacbeth/dat-node/lib/dat-archive'
import * as RandomAccess from '@sammacbeth/random-access-idb-mutable-file';
import * as pda from 'pauls-dat-api';
import { CreateOptions, DatArchive } from './dat';

export default class Network {

  private drives: Map<string, Hyperdrive> = new Map();
  private swarmingFeeds = new Set<string>();
  private _swarm: Discovery
  private connections: { [key: string]: number } = {}

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
      // shutdown the swarm if it is not being used
      if (this.swarmingFeeds.size === 0 && this._swarm) {
        this._swarm.close();
        this._swarm = null;
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
    const storage = await this.getStorage(address);
    const drive = new Hyperdrive(storage, Buffer.from(address, 'hex'), {
      sparse: true,
    });
    this.drives.set(address, drive);
    // wait for ready
    await new Promise((resolve, reject) => {
      drive.ready(err => {
        if (err) reject(err)
        else resolve()
      })
    });

    this.swarm.add(drive);
    this.swarmingFeeds.add(address);

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

  async getArchive(address: string): Promise<DatArchive> {
    const drive = await this.getHyperdrive(address);
    return new DatArchiveImpl({ key: address, dataStructure: drive });
  }

  async createArchive(opts: CreateOptions): Promise<DatArchive> {
    return null;
  }

  async forkArchive(url: string, opts: CreateOptions): Promise<DatArchive> {
    return null;
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
}