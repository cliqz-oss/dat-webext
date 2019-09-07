import { EventEmitter } from 'events';
import Dat, { DatArchive, DatManifest } from './dat';
import resolve from './dns';
import Network from './network';
import DatDb, { IDatInfo } from './db';

// suppress listener warnings
EventEmitter.defaultMaxListeners = 100;

const DEFAULT_SEED_TIME = 1e3 * 60 * 10; // 10 mins

interface DatDNS {
  resolve(name: string): Promise<string>
}

export default class DatLibrary {

  node: Network
  dns: DatDNS
  db: DatDb

  constructor(db: DatDb) {
    // this.storageLock = Promise.resolve();
    this.db = db;
    this.dns = {
      resolve,
    }
    this._createNode();
  }

  _createNode() {
    this.node = new Network();
  }

  getDatInfo(key: string): Promise<IDatInfo> {
    return this.db.library.get(key);
  }

  getLibraryArchives(): Promise<IDatInfo[]> {
    return this.db.library.where('isInLibrary').above(0).toArray();
  }

  setSeedingMode(key: string, seedingMode: number) {
    this.db.library.update(key, {
      seedingMode,
    })
  }

  closeArchive(key: string) {
    if (this.node.isSwarming(key)) {
      this.node.closeArchive(key);
    }
  }

  async deleteArchive(key: string) {
    if (this.node.isSwarming(key)) {
      throw 'Cannot delete an open archive';
    }
    await this.node.deleteArchive(key);
    await this.db.library.delete(key);
  }

  async getArchive(addr: string) {
    return this.getArchiveFromUrl(`dat://${addr}`);
  }

  async getArchiveFromUrl(url: string, version?: number) {
    const key = await this.dns.resolve(url);
    try {
      const dat = await this.node.getDat(key);
      const archive = dat.archive;
      if (archive._version !== version) {
        archive._checkout = version ? dat.drive.checkout(version) : dat.drive;
        archive._version = version || null;
      }

      this.db.updateDat(dat, DEFAULT_SEED_TIME);
      return archive;
    } catch (e) {
      console.error(e);
    }
  }

  async createArchive(opts: DatManifest) {
    const dat = await this.node.createDat(opts);
    this.db.updateDat(dat, DEFAULT_SEED_TIME);
    return dat.archive;
  }

  async forkArchive(url: string, opts: DatManifest) {
    const dat = await this.node.forkDat(url, opts);
    this.db.updateDat(dat, DEFAULT_SEED_TIME);
    return dat.archive;
  }

}
