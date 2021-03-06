import { DatV1API, DatV1WebRTCLoader } from '@sammacbeth/dat-api-v1wrtc';
import { DatV1Loader } from '@sammacbeth/dat-api-v1';
import apiFactory, { DatV2API } from '@sammacbeth/dat2-api';
import HyperdriveAPI from '@sammacbeth/dat-api-core/';
import RandomAccess = require('random-access-idb-mutable-file');
import ram = require('random-access-memory');
import { Config, getConfig, onConfigChanged, DEFAULT_CONFIG } from './config';
import simplePeer = require('./webrtc-config.json');

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
export type DatAPIPair = [DatV1API, DatV2API];

const storeName = 'IDBMutableFile';
const mountStorages = [RandomAccess.mount({
  name: 'dat1data',
  storeName,
}), RandomAccess.mount({
  name: 'dat2data',
  storeName,
})];

async function persistantStorageFactory(ind: number, key: string) {
  try {
    const storage = await mountStorages[ind];
    return (name: string) => storage(`${key}/${name}`);
  } catch (e) {
    console.warn('indexeddb mount failed, falling back to non-persistent storage', e);
    return ram;
  }
}

async function persistantStorageDeleter(ind: number, key: string) {
  const storage = await mountStorages[ind];
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
      wrtcOpts: {
        bootstrap: ["https://dat-signal.test.cliqz.com/"],
        simplePeer,
      },
      persistantStorageDeleter: persistantStorageDeleter.bind(undefined, 0),
      persistantStorageFactory: persistantStorageFactory.bind(undefined, 0),
    });
  }
  return new DatV1Loader({
    autoListen: false,
    persistantStorageDeleter: persistantStorageDeleter.bind(undefined, 0),
    persistantStorageFactory: persistantStorageFactory.bind(undefined, 0),
  });
}

export default (config: Config = DEFAULT_CONFIG): DatAPIPair => {
  const api = new HyperdriveAPI(createLoader(config), {
    persist: true,
    autoSwarm: true,
    driveOptions: {
      sparse: true,
    },
    swarmOptions: {
      announce: config.announceEnabled,
    },
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
      (<any>api.loader.swarm).disc._port = undefined;
    }
    config = newConfig;
    // reload open dats
    openDats.forEach((addr) => {
      api.getDat(addr, { persist: true });
    });
  };
  getConfig().then(onChanged);
  onConfigChanged(onChanged);
  return [api, apiFactory({
    persistantStorageDeleter: persistantStorageDeleter.bind(undefined, 1),
    persistantStorageFactory: persistantStorageFactory.bind(undefined, 1),
    ephemeral: true,
  }, {
    autoSwarm: true,
    persist: true,
    driveOptions: {
      sparse: true,
    },
    swarmOptions: {
      announce: config.announceEnabled,
      upload: config.uploadEnabled,
    },
  })];
};
