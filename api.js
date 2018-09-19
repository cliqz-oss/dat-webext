const Spanan = require('spanan').default;
const DatArchive = require('./dat').DatArchive;
const dialog = require('./dialog');

class DatApi {
  constructor(library) {
    const getArchiveFromUrl = library.getArchiveFromUrl.bind(library);
    this.listenerStreams = new Map();
    const listenerStreams = this.listenerStreams
    let streamCtr = 0;
    const apiWrapper = new Spanan((message) => {
      browser.processScript.sendMessage(message);
    });
    const events = apiWrapper.createProxy();

    this.privateApi = {
      async create(opts) {
        const archive = await DatArchive.create(opts);
        return archive.url;
      },
      async fork(url, opts) {
        const archive = await DatArchive.fork(url, opts);
        return archive.url;
      },
      async dialogResponse(message) {
        dialog.onMessage(message);
      },
      async getArchive(url) {
        return await getArchiveFromUrl(url);
      },
      async listLibrary(filters) {
        return library.getLibraryArchives();
      },
    }

    this.api = {
      resolveName(name) {
        return DatArchive.resolveName(name);
      },
      async create(opts = {}) {
        return await dialog.open({
          action: 'create',
          opts: {
            title: opts.title,
            description: opts.description,
          }
        });
      },
      async fork(url, opts = {}) {
        return await dialog.open({
          action: 'fork',
          opts: {
            url,
            title: opts.title,
            description: opts.description,
          }
        });
      },
      async selectArchive(opts = {}) {
        return await dialog.open({
          action: 'selectArchive',
          opts: {
            title: opts.title,
            buttonLabel: opts.buttonLabel,
            filters: opts.filters,
          }
        });
      },
      async load(url) {
        const archive = await getArchiveFromUrl(url);
        await archive._loadPromise;
        return url;
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
    }

    apiWrapper.export(this.api, {
      respond(response, request) {
        browser.processScript.sendMessage({
          uuid: request.uuid,
          response,
        });
      },
      respondWithError(error, request) {
        browser.processScript.sendMessage({
          uuid: request.uuid,
          error: error.toString(),
        });
      }
    })

    browser.runtime.onMessage.addListener((message) => {
      console.log('recv', message);
      apiWrapper.handleMessage(message);
    });
  }
};

module.exports = DatApi;
