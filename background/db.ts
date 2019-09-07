import Dexie from '@cliqz-oss/dexie';
import Dat, { DatManifest } from './dat';

export default class Database extends Dexie {

  library: Dexie.Table<IDatInfo, string>
  dnsCache: Dexie.Table<IDNSCacheEntry, string>

  keyCache: Map<string, number>
  
  constructor() {
    super('dat-db');
    this.version(1).stores({
      library: 'key, seedingMode, isInLibrary, seedUntil',
      dnsCache: 'host, address',
    });

    this.keyCache = new Map();
    this.library = this.table('library');
    this.dnsCache = this.table('dnsCache');
  }

  async updateDat(dat: Dat, seedTime: number) {
    const now = Date.now();
    const key = dat.drive.key.toString('hex');
    const lastUpdate = this.keyCache.get(key);
    const exists = !!lastUpdate || !!(await this.library.get(key));
    if (!exists) {
      // create new entry
      await this.library.put({
        key,
        isOwner: dat.drive.writable,
        isInLibrary: dat.drive.writable ? 1 : 0,
        firstUsed: now,
        lastUsed: now,
        seedingMode: dat.drive.writable ? 1 : 0,
        seedUntil: now + seedTime,
        size: 0,
      });
    } else if (lastUpdate < now - 30000) {
      // update last used info
      await this.library.update(key, {
        lastUsed: now,
        seedUntil: now + seedTime,
      });
    }
    if (!exists || lastUpdate < now - 30000) {
      this.keyCache.set(key, now);
      // update metadata for this dat
      try {
        const { title, description, type, size } = await dat.archive.getInfo();
        await this.library.update(key, {
          title, description, type, size
        });
      } catch (e) {
      }
    }
  }

}

export interface IDatInfo extends DatManifest {
  key: string
  isOwner: boolean
  isInLibrary: number
  firstUsed: number
  lastUsed: number
  seedingMode: number
  seedUntil: number
  size: number
}

export interface IDNSCacheEntry {
  host: string
  address: string
  expires: number
}
