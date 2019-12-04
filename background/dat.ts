import apiFactory, { DatV1API } from '@sammacbeth/dat-api-v1wrtc';
import RandomAccess = require('random-access-idb-mutable-file');
import HyperdriveAPI from '@sammacbeth/dat-api-core/dist/api';
import { IHyperdrive } from '@sammacbeth/dat-types/lib/hyperdrive';

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

export type DatAPI = DatV1API;
export default () => {
  return apiFactory({
    persistantStorageFactory: (key) => RandomAccess.mount({
      name: key,
      storeName: 'data',
    }),
    persistantStorageDeleter: (key) => {
      return new Promise((resolve, reject) => {
        const request = window.indexedDB.deleteDatabase(key);
        request.onsuccess = () => resolve();
        request.onerror = (err) => reject(err);
      });
    },
  });
};
