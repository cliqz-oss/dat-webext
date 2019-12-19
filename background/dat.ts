import { DatV1API, DatV1WebRTCLoader } from '@sammacbeth/dat-api-v1wrtc';
import { DatV1Loader } from '@sammacbeth/dat-api-v1';
import HyperdriveAPI, { DatLoaderBase, StorageOpts } from '@sammacbeth/dat-api-core/';
import RandomAccess = require('random-access-idb-mutable-file');
import { Config, getConfig, onConfigChanged, DEFAULT_CONFIG } from './config';

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

async function persistantStorageFactory(key) {
  const storage = await mountStorage;
  return (name: string) => storage(`${key}/${name}`);
}

async function persistantStorageDeleter(key) {
  const storage = await mountStorage;
  const tmpVol = storage('tmp');
  const db: IDBDatabase = tmpVol.volume.db;
  const transaction = db.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);
  const req = store.getAllKeys();
  return new Promise<void>((resolve, reject) => {
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
}

function createLoader(config: Config) {
  if (config.wrtcEnabled) {
    return new DatV1WebRTCLoader({
      hyperdiscoveryOpts: { autoListen: false, upload: config.uploadEnabled },
      persistantStorageDeleter,
      persistantStorageFactory,
    });
  }
  return new DatV1Loader({
    autoListen: false,
    persistantStorageDeleter,
    persistantStorageFactory,
  });
}

export default (config: Config = DEFAULT_CONFIG) => {
  const api = new HyperdriveAPI(createLoader(config), {
    persist: true,
    announce: config.announceEnabled,
  });
  // work around to make hyperdiscovery bind a random port
  (<any>api.loader.swarm).disc._port = undefined;

  const onChanged = (newConfig: Config) => {
    if (Object.keys(config).every((k) => config[k] === newConfig[k])) {
      return;
    }
    console.log('Config changed from', config, 'to', newConfig);
    const openDats = [...api.dats.keys()];
    api.shutdown();
    // this is currently protected so we cast to any to avoid a compile error
    (<any>api).defaultDatOptions.announce = newConfig.announceEnabled;
    if (
      config.wrtcEnabled !== newConfig.wrtcEnabled ||
      config.uploadEnabled !== newConfig.uploadEnabled
    ) {
      api.loader = createLoader(newConfig);
    }
    config = newConfig;
    // reload open dats
    openDats.forEach((addr) => {
      api.getDat(addr, { persist: true });
    });
  };
  getConfig().then(onChanged);
  onConfigChanged(onChanged);
  return api;
};
