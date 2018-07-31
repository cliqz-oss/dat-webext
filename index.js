const randomAccessIdb = require('random-access-idb');
const ram = require('random-access-memory');
const parseUrl = require('parse-dat-url');
const Spanan = require('spanan').default;
const DatArchive = require('dat-archive-web');
const DefaultManager = DatArchive.DefaultManager

class Manager extends DefaultManager {
  getStorage(key) {
    // return ram;
    const storage = randomAccessIdb(key, { idb: global.indexedDB });
    return storage;
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

class StreamIterator {
  constructor(stream) {
    this.stream = stream;
    this.state = 'open';
    this.chunks = [];
    this.waitingResolve = null;
    this.waitingReject = null;
    stream.on('close', () => {
      this.state = 'closed';
      if (this.waitingResolve) {
        this.waitingResolve(false);
      }
    });
    stream.on('end', () => {
      this.state = 'end';
      if (this.waitingResolve) {
        this.waitingResolve(false);
      }
    });
    stream.on('error', (e) => {
      this.state = 'error'
      this.error = e;
      if (this.waitingReject) {
        this.waitingReject(this.error);
      }
    });
    stream.on('data', (chunk) => {
      if (this.waitingResolve !== null) {
        const resolve = this.waitingResolve;
        this.waitingReject = null;
        this.waitingResolve = null;
        resolve(chunk);
      } else {
        this.chunks.push(chunk);
      }
    });
  }

  async next() {
    if (this.chunks.length > 0) {
      return Promise.resolve(this.chunks.shift());
    } else if (this.state === 'error') {
      return Promise.reject(this.error);
    } else if (this.state != 'open') {
      return Promise.resolve(false);
    }
    return new Promise((resolve, reject) => {
      this.waitingResolve = resolve;
      this.waitingReject = reject;
    });
  }
}

browser.protocol.registerProtocol('dat', (request) => {
  const url = parseUrl(request.url);
  const archive = getArchive(url.host);
  return {
    content: (async function*() {
      try {
        const stat = await archive.stat(url.pathname, { timeout: 30000 });
        let path = url.pathname;
        if (stat.isDirectory()) {
          path = `${path}index.html`;
        }
        // const contents = await archive.readFile(path, { encoding: 'binary'});
        const stream = archive._archive.createReadStream(path, { start: 0 });
        const streamIt = new StreamIterator(stream);
        while(true) {
          const next = await streamIt.next();
          if (!next) {
            break;
          }
          yield next.buffer;
        }
      } catch(e) {
        const encoder = new TextEncoder('utf8');
        yield encoder.encode(`Error: ${e}`).buffer;
      }
    })()
  };
});

const client = 'cliqz@cliqz.com';
const apiWrapper = new Spanan();
apiWrapper.export({
  resolveName(name) {
    return DatArchive.resolveName(name);
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
}, {
  respond(response, request) {
    browser.runtime.sendMessage(client, {
      uuid: request.uuid,
      response,
    });
  },
  respondWithError(error, request) {
    browser.runtime.sendMessage(client, {
      uuid: request.uuid,
      error,
    });
  }
})

browser.runtime.onMessageExternal.addListener((message) => {
  console.log('recv', message);
  apiWrapper.handleMessage(message);
});
