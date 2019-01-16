import * as RandomAccess from '@sammacbeth/random-access-idb-mutable-file';
import * as parseUrl from 'parse-dat-url';
import { DatArchive } from './dat';

const ARCHIVE_LIST_KEY = 'archives';

export interface ArchiveMetadata extends browser.storage.StorageObject {
  isOwner: boolean
  key: string
  open: boolean
  created: number
  lastUsed: number,
  content?: {}
  metadata?: {}
}

export interface Archives extends browser.storage.StorageObject {
  [key: string]: ArchiveMetadata
}

export default class DatLibrary {

  openArchives: Map<string, any>
  storageLock: Promise<void>
  archives: Archives

  constructor() {
    this.openArchives = new Map();
    this.storageLock = Promise.resolve();
    this.archives = {};
  }

  async getStorage(key: string, secretKey: string) {
    return await RandomAccess.mount({
      name: key,
      storeName: 'data',
    });
  }

  async init() {
    this.archives = ((await browser.storage.local.get(ARCHIVE_LIST_KEY))[ARCHIVE_LIST_KEY] || {}) as Archives;
  }

  async _persistArchives() {
    await this.storageLock;
    this.storageLock = browser.storage.local.set({ [ARCHIVE_LIST_KEY]: this.archives });
  }

  getArchiveState(key) {
    const open = this.openArchives.has(key)
    const state: ArchiveMetadata = this.archives[key] || { open, isOwner: false, key, created: Date.now(), lastUsed: 0 };
    if (state.open) {
      const archive = this.openArchives.get(key);
      state.content = {
        length: archive._archive.content.length,
        byteLength: archive._archive.content.byteLength,
        downloaded: archive._archive.content.downloaded(),
      };
      state.metadata = {
        length: archive._archive.metadata.length,
        byteLength: archive._archive.metadata.byteLength,
        downloaded: archive._archive.metadata.downloaded(),
      };
    }
    return state;
  }

  getArchives() {
    return Object.values(this.archives);
  }

  getLibraryArchives() {
    return this.getArchives().filter(({ inLibrary }) => inLibrary);
  }

  getArchivesStates() {
    return Object.keys(this.archives).map(key => this.getArchiveState(key));
  }

  closeArchive(key) {
    if (this.openArchives.has(key)) {
      const archive = this.openArchives.get(key);
      archive.close();
      this.openArchives.delete(key);
    }
  }

  async deleteArchive(key) {
    if (this.openArchives.has(key)) {
      throw 'Cannot delete an open archive';
    }
    window.indexedDB.deleteDatabase(key);
    delete this.archives[key];
    return this._persistArchives();
  }

  async _addLibraryEntry(archive) {
    const key = archive._archive.key.toString('hex');
    if (!this.archives[key]) {
      this.archives[key] = {
        key,
        open: true,
        created: Date.now(),
        lastUsed: Date.now(),
        isOwner: archive._archive.writable,
        inLibrary: archive._archive.writable,
      };
      try {
        const { title, description, type } = await archive.getInfo({ timeout: 30000 });
        this.archives[key].title = title;
        this.archives[key].description = description;
        this.archives[key].type = type;
      } catch(e) {
      }
      this._persistArchives();
    }
  }

  _touchLibraryEntry(archive) {
    if (!archive._archive) {
      return;
    }
    const key = archive._archive.key.toString('hex');
    if (this.archives[key]) {
      this.archives[key].lastUsed = Date.now();
    }
  }

  async getArchive(addr) {
    const key = await DatArchive.resolveName(`dat://${addr}`);
    let archive;

    if (!this.openArchives.has(key)) {
      archive = new DatArchive(`dat://${addr}`)
      this.openArchives.set(key, archive);
      await archive._loadPromise;
      this._addLibraryEntry(archive);
    }
    archive = this.openArchives.get(key);
    this._touchLibraryEntry(archive);
    return archive;
  }

  async getArchiveFromUrl(url) {
    const { host } = parseUrl(url);
    return this.getArchive(host);
  }


}
