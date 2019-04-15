import { EventEmitter } from 'events';
import * as RandomAccess from '@sammacbeth/random-access-idb-mutable-file';
import { createNode } from '@sammacbeth/dat-node';
import { DatArchive, Hyperdrive, CreateOptions } from './dat';
import resolve from './dns';

// suppress listener warnings
EventEmitter.defaultMaxListeners = 100;

const ARCHIVE_LIST_KEY = 'archives';
const DEFAULT_SEED_TIME = 1e3 * 60 * 10; // 10 mins

export interface ArchiveMetadata extends browser.storage.StorageObject {
  isOwner: boolean
  key: string
  open: boolean
  created: number
  lastUsed: number,
  content?: {}
  metadata?: {}
  forceSeeding: boolean
  seedUntil: number
}

export interface Archives extends browser.storage.StorageObject {
  [key: string]: ArchiveMetadata
}

interface DatStorage {
  getStorage(key: string): Promise<any>
}

interface DatDNS {
  resolve(name: string): Promise<string>
}

interface DatInfo {
  key: string
  dataStructureId: string
  discoveryKey?: string
  loadPromise: Promise<void>
  dataStructure: Hyperdrive
  isSwarming: boolean
  replicationStreams?: any[]
}

interface DatNode extends EventEmitter {
  storage: DatStorage
  dns: DatDNS
  _dats: {
    [key: string]: DatInfo
  }
  listen(port?: number): void
  close(): Promise<void>
  getArchive(address: string): Promise<DatArchive>
  createArchive(opts: CreateOptions): Promise<DatArchive>
  forkArchive(url: string, opts: CreateOptions): Promise<DatArchive>
  closeArchive(key: string): void
}

export default class DatLibrary implements DatStorage {

  storageLock: Promise<void>
  archives: Archives
  dats: Map<string, DatArchive>
  node: DatNode
  dns: DatDNS

  constructor() {
    this.storageLock = Promise.resolve();
    this.archives = {};
    this.dats = new Map();
    this.dns = {
      resolve,
    }
    this._createNode();
  }

  _createNode() {
    if (window.navigator.platform.startsWith('Win')) {
      this.node = createNode({
        storage: this,
        dns: this.dns,
        autoListen: true,
      });
    } else {
      console.warn('Falling back to discovery-swarm-stream');
      this.node = createNode({
        storage: this,
        dns: this.dns,
        autoListen: false,
        dss: 'wss://discovery.dat-web.eu',
      });
    }
    this.node.on('error', (err) => {
      console.warn('node error', err);
      setTimeout(() => this._createNode(), 5000);
      this.node.close();
    });
  }

  async getStorage(key: string): Promise<any> {
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

  async getArchiveState(key) {
    const info = this.node._dats[key];
    const open = info && info.isSwarming
    const state: ArchiveMetadata = this.archives[key];
    if (!state) {
      return null;
    }
    state.open = !!open;
    if (open) {
      const drive = info.dataStructure
      state.content = {
        length: drive.content.length,
        byteLength: drive.content.byteLength,
        downloaded: drive.content.downloaded(),
      };
      state.metadata = {
        length: drive.metadata.length,
        byteLength: drive.metadata.byteLength,
        downloaded: drive.metadata.downloaded(),
      };
      const archive = await this.node.getArchive(`dat://${key}`);
      const { title, description, type } = await archive.getInfo({ timeout: 30000 });
      state.title = title;
      state.description = description;
      state.type = type;
    }
    return state;
  }

  getArchives() {
    return Object.values(this.archives);
  }

  getLibraryArchives() {
    return Promise.all(
      this.getArchives()
      .filter(({ inLibrary }) => inLibrary)
      .map(state => this.getArchiveState(state.key))
    );
  }

  getArchivesStates() {
    return Promise.all(Object.keys(this.archives).map(key => this.getArchiveState(key)));
  }

  closeArchive(key) {
    if (this.node._dats[key]) {
      this.node.closeArchive(key);
    }
    if (this.dats.has(key)) {
      this.dats.delete(key);
    }
  }

  async deleteArchive(key) {
    if (this.node._dats[key]) {
      throw 'Cannot delete an open archive';
    }
    window.indexedDB.deleteDatabase(key);
    delete this.archives[key]
    return this._persistArchives();
  }

  async _addLibraryEntry(archive: DatArchive) {
    const key = archive._dataStructure.key.toString('hex');
    if (!this.archives[key]) {
      this.archives[key] = {
        key,
        open: true,
        created: Date.now(),
        lastUsed: Date.now(),
        isOwner: archive._dataStructure.writable,
        inLibrary: archive._dataStructure.writable,
        forceSeeding: false,
        seedUntil: Date.now() + DEFAULT_SEED_TIME,
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

  _touchLibraryEntry(archive: DatArchive) {
    if (!archive._dataStructure) {
      return;
    }
    const key = archive._dataStructure.key.toString('hex');
    if (this.archives[key]) {
      this.archives[key].lastUsed = Date.now();
      this.archives[key].seedUntil = Math.max(
        this.archives[key].seedUntil,
        this.archives[key].lastUsed + DEFAULT_SEED_TIME
      );
      this._persistArchives();
    }
  }

  async getArchive(addr: string) {
    return this.getArchiveFromUrl(`dat://${addr}`);
  }

  async getArchiveFromUrl(url: string, version?: number) {
    const key = await this.dns.resolve(url);
    const existing = key in this.archives;
    try {
      let archive: DatArchive;
      if (this.dats.has(key)) {
        archive = this.dats.get(key);
      } else {
        archive = await this.node.getArchive(`dat://${key}`);
        this.dats.set(key, archive);
      }
      if (archive._version !== version) {
        archive._checkout = version ? archive._dataStructure.checkout(version) : archive._dataStructure;
        archive._version = version || null;
      }

      if (!existing) {
        this._addLibraryEntry(archive);
      }
      this._touchLibraryEntry(archive);
      return archive;
    } catch (e) {
      console.error(e);
    }
  }


}
