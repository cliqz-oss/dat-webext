const randomAccessIdb = require('random-access-idb');
const ram = require('random-access-memory');
const parseUrl = require('parse-dat-url');
const Spanan = require('spanan').default;
const DatArchive = require('dat-archive-web');
const DefaultManager = DatArchive.DefaultManager
const protocolHandler = require('./protocol');

class Manager extends DefaultManager {
  getStorage(key) {
    // return ram;
    const storage = randomAccessIdb(key, { idb: global.indexedDB });
    return storage;
  }
  onAddArchive(key, secretKey, options) {
    console.log('add archive', key, secretKey, options);
  }
}
DatArchive.setManager(new Manager('http://localhost:3002'));

const archives = new Map();

function getArchive(addr) {
  if (!archives.has(addr)) {
    archives.set(addr, new DatArchive(`dat://${addr}`));
  }
  return archives.get(addr);
}

function getArchiveFromUrl(url) {
  const { host } = parseUrl(url);
  return getArchive(host);
}

browser.protocol.registerProtocol('dat', (request) => {
  return protocolHandler.handleRequest(request, { getArchive });
});

const listenerStreams = new Map();
let streamCtr = 0;
const client = 'cliqz@cliqz.com';
const apiWrapper = new Spanan((message) => {
  browser.runtime.sendMessage(client, message);
});
const events = apiWrapper.createProxy();
const api = {
  resolveName(name) {
    return DatArchive.resolveName(name);
  },
  async create(opts) {
    const archive = await DatArchive.create(opts);
    return archive.url;
  },
  getInfo(url, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.getInfo(opts);
  },
  configure(url, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.configure(opts);
  },
  async stat(url, path, opts) {
    const archive = getArchiveFromUrl(url);
    const stat = await archive.stat(path, opts);
    stat._isDirectory = stat.isDirectory();
    stat._isFile = stat.isFile();
    return stat;
  },
  readFile(url, path, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.readFile(path, opts);
  },
  readdir(url, path, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.readdir(path, opts);
  },
  history(url, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.history(opts);
  },
  writeFile(url, path, data, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.writeFile(path, data, opts);
  },
  mkdir(url, path) {
    const archive = getArchiveFromUrl(url);
    return archive.mkdir(path);
  },
  unlink(url, path) {
    const archive = getArchiveFromUrl(url);
    return archive.unlink(path);
  },
  rmdir(url, path, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.rmdir(path, opts);
  },
  copy(url, path, dstPath, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.copy(path, dstPath, opts);
  },
  rename(url, oldPath, newPath, opts) {
    const archive = getArchiveFromUrl(url);
    return archive.rename(oldPath, newPath, opts);
  },
  watch(url, pattern) {
    const archive = getArchiveFromUrl(url);
    const streamId = streamCtr++;
    const stream = archive.createFileActivityStream(pattern);
    listenerStreams.set(streamId, stream);
    return streamId;
  },
  addEventListenerToStream(streamId, eventType) {
    const stream = listenerStreams.get(streamId);
    const listener = async (evnt) => {
      const response = await events.pushEvent({
        stream: streamId,
        type: eventType,
        data: evnt,
      });
      if (!response) {
        stream.removeEventListener(response);
      }
    }
    stream.addEventListener(eventType, listener);
  },
  closeEventStream(streamId) {
    const stream = listenerStreams.get(streamId);
    stream.close();
    listenerStreams.delete(streamId);
  }
};
global.api = api;
apiWrapper.export(api, {
  respond(response, request) {
    browser.runtime.sendMessage(client, {
      uuid: request.uuid,
      response,
    });
  },
  respondWithError(error, request) {
    browser.runtime.sendMessage(client, {
      uuid: request.uuid,
      error: error.toString(),
    });
  }
})

browser.runtime.onMessageExternal.addListener((message) => {
  console.log('recv', message);
  apiWrapper.handleMessage(message);
});
