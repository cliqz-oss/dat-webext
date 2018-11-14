const parseUrl = require('parse-dat-url');
const pda = require('pauls-dat-api');
const joinPaths = require('path').join;
const mime = require('mime');
const { DNSLookupFailed } = require('./errors');

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

function responseText(string) {
  const encoder = new TextEncoder('utf8');
  return encoder.encode(string).buffer;
}

function timeoutWithError(ms, errorCtr) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(errorCtr());
    }, ms);
  })
}

async function* fileStream(archive, path) {
  const stream = archive._archive.createReadStream(path, { start: 0 });
  const streamIt = new StreamIterator(stream);
  while (true) {
    const next = await streamIt.next();
    if (!next) {
      break;
    }
    yield next.buffer;
  }
}

const ERROR = {
  ARCHIVE_LOAD_TIMEOUT: 'ARCHIVE_LOAD_TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
  DIRECTORY: 'DIRECTORY',
}

class DatHandler {
  constructor(getArchive) {
    this.getArchive = getArchive;
  }

  async loadArchive(host, timeout = 30000) {
    const loadArchive = this.getArchive(host);
    await Promise.race([
      loadArchive,
      timeoutWithError(timeout, () => new Error(ERROR.ARCHIVE_LOAD_TIMEOUT))
    ]);
    return loadArchive;
  }

  async resolvePath(host, pathname, version) {
    const timeoutAt = Date.now() + 30000;
    const archive = await this.loadArchive(host);
    const manifest = await pda.readManifest(archive._archive).catch(_ => ({ }));
    const root = manifest.web_root || '';
    const path = decodeURIComponent(pathname);
    let lastPath;

    async function tryStat(testPath) {
      try {
        lastPath = testPath;
        return await archive.stat(testPath, { timeout: timeoutAt - Date.now() });
      } catch (e) {
        return false;
      }
    }

    let f = await tryStat(joinPaths(root, path));
    if (f && f.isFile()) {
      return {
        archive,
        path: lastPath,
      }
    }
    // for directories try to find an index file
    if (f && f.isDirectory()) {
      if (await tryStat(joinPaths(root, path, 'index.html'))) {
        return {
          archive,
          path: lastPath,
        }
      }
      if (await tryStat(joinPaths(root, path, 'index.htm'))) {
        return {
          archive,
          path: lastPath,
        }
      }
      // error list directory
      throw new Error(ERROR.DIRECTORY);
    }
    if (await tryStat(joinPaths(root, `${path}.html`))) {
      return {
        archive,
        path: lastPath,
      }
    }

    if (manifest.fallback_page) {
      if (await tryStat(joinPaths(root, manifest.fallback_page))) {
        return {
          archive,
          path: lastPath,
        }
      }
    }
    console.log('not found', root, path, await archive.readdir('/', { recursive: true }))
    throw new Error(ERROR.NOT_FOUND);
  }

  handleRequest(request) {
    const self = this;
    const { host, pathname, version } = parseUrl(request.url);
    return {
      contentType: mime.getType(decodeURIComponent(pathname)) || 'text/html',
      content: (async function* () {
        try {
          const { archive, path } = await self.resolvePath(host, pathname, version);
          const data = fileStream(archive, path);
          for await (const chunk of data) {
            yield chunk;
          }
        } catch (e) {
          if (e instanceof DNSLookupFailed) {
            yield responseText(`DNS Lookup failed for ${e.message}`);
            return;
          } else if (e.message === ERROR.ARCHIVE_LOAD_TIMEOUT) {
            yield responseText('Unable locate the Dat archive on the network.');
            return;
          } else if (e.message === ERROR.NOT_FOUND) {
            yield responseText('Not found:', e);
          } else {
            console.error(e);
            yield responseText('Unexpected error:', e);
          }
        }
      })(),
    }
  }
}

module.exports = DatHandler;
