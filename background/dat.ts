import Hyperdrive from '@sammacbeth/types/hyperdrive';
import DatArchiveImpl = require('@sammacbeth/dat-node/lib/dat-archive')

export interface DatManifest {
  title?: string
  description?: string
  type?: string
}

export interface SelectArchiveOptions {
  title?: string
  buttonLabel?: string
  filters?: {
    isOwner: boolean
    type?: string | string[]
  }
}

export interface DatArchive {
  url: string
  _dataStructure: Hyperdrive
  _checkout: Hyperdrive
  _version: number
  getInfo(opts?): Promise<any>
  stat(filepath: string, opts?): Promise<any>
  readdir(path: string, opts?)
}

export default class Dat {

  drive: Hyperdrive
  archive: DatArchive
  isSwarming: boolean
  ready: Promise<void>
  _swarm: any

  constructor(drive: Hyperdrive, swarm: any) {
    this.drive = drive;
    this.archive = new DatArchiveImpl({
      key: this.drive.key.toString('hex'),
      dataStructure: this.drive,
    });
    this.isSwarming = false;
    this._swarm = swarm;
    this.ready = new Promise((resolve, reject) => {
      if (!this.drive.writable && !this.drive.metadata.length) {
        this.drive.metadata.update(err => {
          if (err) reject(err)
          else resolve()
        })
      } else {
        resolve();
      }
    });
  }

  get isOwner() {
    return this.drive.writable;
  }

  async joinNetwork() {
    this._swarm.add(this.drive);

    // await initial metadata sync if not the owner
    await this.ready;

    if (!this.drive.writable) {
      // always download all metadata
      this.drive.metadata.download({start: 0, end: -1})
    }
  }

  leaveNetwork() {
    if (this.isSwarming) {
      this._swarm.leave(this.drive.discoveryKey);
      this.isSwarming = false;
    }
  }

  close() {
    this.leaveNetwork();
    this.drive.close();
  }
}