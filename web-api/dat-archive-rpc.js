const base64js = require('base64-js');
const parseUrl = require('parse-dat-url');
const EventEmitter = require('events').EventEmitter;

module.exports = function (rpc, eventBus) {
  class StreamListener extends EventEmitter {
    constructor(getStreamId, events) {
      super(events);
      this.getId = getStreamId;

      this.registeredTypes = new Set();
      this.onEvent = this.onEvent.bind(this);
      this.getId.then((id) => {
        this.id = id;
        eventBus.on('event', this.onEvent);
      });
      window.addEventListener('beforeunload', () => {
        rpc.closeEventStream(this.id);
      });
    }

    onEvent(event) {
      if (event.stream === this.id) {
        this.emit(event.type, event.data);
      }
    }

    addEventListener(eventType, fn) {
      this.on(eventType, fn);
      if (!this.registeredTypes.has(eventType)) {
        this.getId.then(id => rpc.addEventListenerToStream(id, eventType));
      }
    }

    close() {
      this.getId.then(id => rpc.closeEventStream(id));
      eventBus.removeListener('event', this.onEvent);
    }
  }

  class Stat {
    constructor(stat) {
      Object.assign(this, stat);
    }

    isDirectory() {
      return this._isDirectory;
    }

    isFile() {
      return this._isFile;
    }
  }

  function cleanPath(path) {
    // standardise path format across platforms
    // replace windows style separators with unix
    const cleanedPath = path.replace(/\\/g, '/');
    if (cleanedPath.startsWith('/')) {
      return cleanedPath.substring(1);
    }
    return cleanedPath;
  }

  return class DatArchive {
    constructor(datUrl) {
      // in some cases a http url might be passed here
      // (e.g. if document.location is used by the page)
      const parts = parseUrl(datUrl);
      if (!parts.host) {
        throw new Error('Invalid dat:// URL');
      }
      this.url = `dat://${parts.host}`;
    }

    static async create(opts) {
      return rpc.create(opts).then(url => new DatArchive(url));
    }

    static async fork(url, opts) {
      return rpc.fork(url, opts).then(newUrl => new DatArchive(newUrl));
    }

    static async selectArchive(opts) {
      return rpc.selectArchive(opts).then(url => new DatArchive(url));
    }

    static async resolveName(name) {
      return rpc.resolveName(name);
    }

    static async load(url) {
      return rpc.load(url).then(() => new DatArchive(url));
    }

    async getInfo(opts) {
      return rpc.getInfo(this.url, opts);
    }

    async configure(opts) {
      return rpc.configure(this.url, opts);
    }

    async copy(path, dstPath, opts) {
      return rpc.copy(this.url, path, dstPath, opts);
    }

    async stat(path, opts) {
      const stat = await rpc.stat(this.url, path, opts);
      return new Stat(stat);
    }

    async readFile(path, opts) {
      if (opts && opts.encoding === 'binary') {
        // use base64 and then convert back to binary here
        const optsCopy = Object.assign({}, opts);
        optsCopy.encoding = 'base64';
        const b64Contents = await this.readFile(path, optsCopy);
        return base64js.toByteArray(b64Contents).buffer;
      }
      return rpc.readFile(this.url, path, opts);
    }

    async readdir(path, opts) {
      const dir = await rpc.readdir(this.url, path, opts);
      if (opts && opts.stat) {
        return dir.map(({ name, stat }) => ({ name: cleanPath(name), stat: new Stat(stat) }));
      }
      return dir.map(cleanPath);
    }

    async writeFile(path, data, opts) {
      if ((opts && opts.encoding === 'binary') || data instanceof ArrayBuffer) {
        // convert binary to base64 and write that instead
        const optsCopy = Object.assign({}, opts);
        optsCopy.encoding = 'base64';
        return this.writeFile(path, base64js.fromByteArray(new Uint8Array(data)), optsCopy);
      }
      return rpc.writeFile(this.url, path, data, opts);
    }

    async mkdir(path) {
      return rpc.mkdir(this.url, path);
    }

    async unlink(path) {
      return rpc.unlink(this.url, path);
    }

    async rmdir(path, opts) {
      return rpc.rmdir(this.url, path, opts);
    }

    async rename(oldPath, newPath, opts) {
      return rpc.rename(this.url, oldPath, newPath, opts);
    }

    async diff(/* opts */) {
      return []; // deprecated
    }

    async commit() {
      return Promise.resolve([]); // deprecated
    }

    async revert() {
      return Promise.reject('deprecated method');
    }

    async history(opts) {
      return rpc.history(this.url, opts);
    }

    async download(path, opts) {
      return rpc.download(this.url, path, opts);
    }

    watch(pattern) {
      const stream = new StreamListener(rpc.watch(this.url, pattern), ['changed', 'invalidated']);
      return stream;
    }

    createFileActivityStream(pattern) {
      return this.watch(pattern);
    }

    createNetworkActivityStream() {
    }
  };
}
