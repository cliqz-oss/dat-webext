const randomAccessIdb = require('random-access-idb');
const Spanan = require('spanan').default;
const protocolHandler = require('./protocol');
const DatLibrary = require('./library');
const dat = require('./dat');
const DatArchive = dat.DatArchive;

const library = new DatLibrary((key) => randomAccessIdb(key, { idb: global.indexedDB }));
library.init();
dat.initManager(library);
global.library = library;

const getArchive = library.getArchive.bind(library);
const getArchiveFromUrl = library.getArchiveFromUrl.bind(library);

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
  async fork(url, opts) {
    const archive = await DatArchive.fork(url, opts);
    return archive.url;
  },
  async getInfo(url, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.getInfo(opts);
  },
  async configure(url, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.configure(opts);
  },
  async stat(url, path, opts) {
    const archive = await getArchiveFromUrl(url);
    const stat = await archive.stat(path, opts);
    stat._isDirectory = stat.isDirectory();
    stat._isFile = stat.isFile();
    return stat;
  },
  async readFile(url, path, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.readFile(path, opts);
  },
  async readdir(url, path, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.readdir(path, opts);
  },
  async history(url, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.history(opts);
  },
  async writeFile(url, path, data, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.writeFile(path, data, opts);
  },
  async mkdir(url, path) {
    const archive = await getArchiveFromUrl(url);
    return archive.mkdir(path);
  },
  async unlink(url, path) {
    const archive = await getArchiveFromUrl(url);
    return archive.unlink(path);
  },
  async rmdir(url, path, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.rmdir(path, opts);
  },
  async copy(url, path, dstPath, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.copy(path, dstPath, opts);
  },
  async rename(url, oldPath, newPath, opts) {
    const archive = await getArchiveFromUrl(url);
    return archive.rename(oldPath, newPath, opts);
  },
  async watch(url, pattern) {
    const archive = await getArchiveFromUrl(url);
    const key = archive._archive.key.toString('hex');
    const streamId = streamCtr++;
    const stream = archive.createFileActivityStream(pattern);
    listenerStreams.set(streamId, {
      stream,
      key,
    });

    return streamId;
  },
  addEventListenerToStream(streamId, eventType) {
    const { stream } = listenerStreams.get(streamId);
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
    const { stream } = listenerStreams.get(streamId);
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


// load my own archives
library.getArchives().filter(a => a.isOwner).forEach((a) => library.getArchive(a.key));

// manage open archives
setInterval(() => {
  const archives = library.getArchives();
  // get archives which have active listeners
  const activeStreams = new Set();
  listenerStreams.forEach(({ key }) => activeStreams.add(key));

  const closeCutoff = Date.now() - (1000 * 60 * 10)
  archives.filter((a) => a.open && !a.isOwner && !activeStreams.has(a.key) && a.lastUsed < closeCutoff).forEach((a) => {
    library.closeArchive(a.key);
  });
  const calculateUsage = (type) => type ? (type.downloaded / type.length) * type.byteLength : 0;
  const mb = 1024 * 1024;
  const usage = archives.map(a => [a.key, (calculateUsage(a.metadata) + calculateUsage(a.content)) / mb]);
  console.log('data usage', usage);
}, 60000);