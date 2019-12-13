import apiFactory, { DatV1API } from '@sammacbeth/dat-api-v1wrtc';
import RandomAccess = require('random-access-idb-mutable-file');

export interface DatManifest {
  title?: string;
  description?: string;
  type?: string[];
}

export interface SelectArchiveOptions {
  title?: string;
  buttonLabel?: string;
  filters?: {
    isOwner: boolean;
    type?: string | string[];
  };
}

export type DatAPI = DatV1API;

const storeName = 'IDBMutableFile';
const mountStorage = RandomAccess.mount({
  name: 'dat1data',
  storeName,
});

export default () => {
  const api = apiFactory({
    hyperdiscoveryOpts: {
      autoListen: false
    },
    persistantStorageFactory: async (key) => {
      const storage = await mountStorage;
      return (name) => storage(`${key}/${name}`);
    },
    persistantStorageDeleter: async (key) => {
      const storage = await mountStorage;
      const tmpVol = storage('tmp');
      const db: IDBDatabase = tmpVol.volume.db;
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const req = store.getAllKeys();
      return new Promise((resolve, reject) => {
        req.onsuccess = async () => {
          const keys = req.result;
          const deletions = keys
            .filter((k: string) => k.startsWith(`/${key}`))
            .map((k) => {
              tmpVol.volume.delete(k);
            });
          await Promise.all(deletions);
          resolve();
        };
        req.onerror = (err) => {
          reject(err);
        };
      });
    },
  });
  // work around to make hyperdiscovery bind a random port
  (<any> api.loader.swarm).disc._port = undefined;
  return api;
};
