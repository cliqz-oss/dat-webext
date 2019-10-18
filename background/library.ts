import Dat1Loader from '@sammacbeth/dat-api/build/lib/v1wrtc';
import DatAPI from '@sammacbeth/dat-api/build/lib/';
import RandomAccess = require('random-access-idb-mutable-file');
import pda = require('pauls-dat-api');
import { EventEmitter } from 'events';
import { DatManifest } from './dat';
import DatDNS from './dns';
import DatDb, { IDatInfo } from './db';
import { DatArchive } from '@sammacbeth/dat-api/lib/dat-archive';

// suppress listener warnings
EventEmitter.defaultMaxListeners = 100;

const DEFAULT_SEED_TIME = 1e3 * 60 * 5; // 5 mins

export default class DatLibrary {

  api: DatAPI
  dns: DatDNS
  db: DatDb

  constructor(db: DatDb) {
    // this.storageLock = Promise.resolve();
    this.db = db;
    this.dns = new DatDNS(this.db);
    this.api = new DatAPI(new Dat1Loader({
      persistantStorageFactory: (key) => RandomAccess.mount({
        name: key,
        storeName: 'data',
      }),
    }));
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
  }

  async deleteArchive(key: string) {
    const dat = this.api.dats.get(key);
    if (dat && dat.isSwarming) {
      throw 'Cannot delete an open archive';
    }
    await this.api.deleteDatData(key);
    await this.db.library.delete(key);
  }

  async getArchive(addr: string) {
    return this.getArchiveFromUrl(`dat://${addr}`);
  }

  async getArchiveFromUrl(url: string, version?: number): Promise<DatArchive> {
    const key = await this.dns.resolve(url);
    try {
      const dat = await this.api.getDat(key, true, { persist: true, sparse: true });
      await dat.ready;
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
    const dat = await this.api.createDat(true, { persist: true, sparse: false });
    await dat.archive.configure(opts);
    this.db.updateDat(dat, DEFAULT_SEED_TIME);
    return dat.archive;
  }

  async forkArchive(url: string, manifest: DatManifest) {
    // load source
    const srcDat = await this.getArchiveFromUrl(url);
    // get source manifest
    const srcManifest = await (pda.readManifest(srcDat._dataStructure).catch(_ => ({})));
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
    const dstDat = await this.api.createDat(true, { persist: true, sparse: false });
    pda.writeManifest(dstDat.archive, dstManifest);
    await pda.exportArchiveToArchive({
      srcArchive: srcDat._dataStructure,
      dstArchive: dstDat.drive,
      skipUndownloadedFiles: false,
      ignore: ['/.dat', '/.git', '/dat.json'],
    });

    this.db.updateDat(dstDat, DEFAULT_SEED_TIME);
    return dstDat.archive;
  }

}
