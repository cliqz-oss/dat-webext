import { DatAPI, DatAPIPair } from './dat';
import { EventEmitter } from 'events';
import DatDb, { IDatInfo } from './db';

// suppress listener warnings
EventEmitter.defaultMaxListeners = 100;

const DEFAULT_SEED_TIME = 1e3 * 60 * 5; // 5 mins

export default class DatLibrary {

  api: DatAPIPair
  db: DatDb

  constructor(db: DatDb, node: DatAPIPair) {
    this.db = db;
    this.api = node;

    this.api.forEach((n) => {
      n.on('use', (dat) => {
        this.db.updateDat(dat, DEFAULT_SEED_TIME);
      });
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

  isOpen(key: string) {
    return this.api.some((n) => n.dats.has(key));
  }

  isSwarming(key: string) {
    return this.api.some((n) => n.dats.has(key) && n.dats.get(key).isSwarming);
  }

  closeArchive(key: string) {
    this.api.forEach((api) => {
      const dat = api.dats.get(key);
      if (dat && dat.isSwarming) {
        dat.close();
      }
      if (api.dats.size === 0) {
        console.log('shutdown node');
        api.shutdown();
      }
    })
  }

  async deleteArchive(key: string) {
    for (const api of this.api) {
      const dat = api.dats.get(key);
      if (!dat) {
        continue;
      }
      if (dat && dat.isSwarming) {
        throw 'Cannot delete an open archive';
      }
      await api.deleteDatData(key);
    }
    await this.db.library.delete(key);
  }
}
