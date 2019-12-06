import { DatAPI } from './dat';
import { EventEmitter } from 'events';
import DatDb, { IDatInfo } from './db';

// suppress listener warnings
EventEmitter.defaultMaxListeners = 100;

const DEFAULT_SEED_TIME = 1e3 * 60 * 5; // 5 mins

export default class DatLibrary {

  api: DatAPI
  db: DatDb

  constructor(db: DatDb, node: DatAPI) {
    this.db = db;
    this.api = node;

    this.api.on('use', (dat) => {
      this.db.updateDat(dat, DEFAULT_SEED_TIME);
    });
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
    const dat = this.api.dats.get(key);
    if (dat && dat.isSwarming) {
      dat.close();
    }
    if (this.api.dats.size === 0) {
      console.log('shutdown node');
      this.api.shutdown();
    }
  }

  async deleteArchive(key: string) {
    const dat = this.api.dats.get(key);
    if (dat && dat.isSwarming) {
      throw 'Cannot delete an open archive';
    }
    await this.api.deleteDatData(key);
    await this.db.library.delete(key);
  }
}
