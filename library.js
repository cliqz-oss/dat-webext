const parseUrl = require('parse-dat-url');
const DatArchive = require('./dat').DatArchive;

const ARCHIVE_LIST_KEY = 'archives';

module.exports = class DatLibrary {

  constructor(hyperdriveStorage) {
    this.getStorage = hyperdriveStorage;
    this.openArchives = new Map();
    this.storageLock = Promise.resolve();
    this.archives = {};
    this.nameCache = new Map();
  }

  async init() {
    this.archives = (await browser.storage.local.get(ARCHIVE_LIST_KEY))[ARCHIVE_LIST_KEY] || {};
  }

  async _persistArchives() {
    await this.storageLock;
    this.storageLock = browser.storage.local.set({ [ARCHIVE_LIST_KEY]: this.archives });
  }

  getArchiveState(key) {
    const state = this.archives[key];
    state.open = this.openArchives.has(key)
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
    const archiveList = Object.keys(this.archives).map((key) => this.getArchiveState(key));
    this._persistArchives();
    return archiveList;
  }

  closeArchive(key) {
    if (this.openArchives.has(key)) {
      const archive = this.openArchives.get(key);
      archive.close();
      this.openArchives.delete(key);
    }
  }

  async _addLibraryEntry(archive) {
    const key = archive._archive.key.toString('hex');
    if (!this.archives[key]) {
      this.archives[key] = {
        key,
        created: Date.now(),
        lastUsed: Date.now(),
        isOwner: archive._archive.writable,
      };
      this._persistArchives();
      console.log('xxx', this.archives);
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

  async _resolveName(name) {
    if (!this.nameCache.has(name)) {
      const addr = await DatArchive.resolveName(`dat://${name}`);
      this.nameCache.set(name, addr);
    }
    return this.nameCache.get(name);
  }

  async getArchive(addr) {
    const key = await this._resolveName(addr);
    let archive;

    if (!this.openArchives.has(key)) {
      archive = new DatArchive(`dat://${addr}`)
      this.openArchives.set(key, archive);
      archive._loadPromise.then(() => {
        this._addLibraryEntry(archive);
      });
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