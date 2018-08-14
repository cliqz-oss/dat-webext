const parseUrl = require('parse-dat-url');
const pda = require('pauls-dat-api');
const joinPaths = require('path').join;
const mime = require('mime');

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

module.exports = {
  handleRequest(request, { getArchive }) {
    const { host, pathname, version, search } = parseUrl(request.url);
    let filePath = decodeURIComponent(pathname);
    return {
      contentType: mime.getType(filePath) || undefined,
      content: (async function* () {
        const archive = await getArchive(host);
        try {
          let isFolder = filePath.endsWith('/');
          const manifest = await pda.readManifest(archive._archive).catch(_ => { });

          let entry = null;
          const tryStat = async (testPath) => {
            // abort if we've already found it
            if (entry) return
            // apply the web_root config
            if (manifest && manifest.web_root) {
              if (testPath) {
                testPath = joinPaths(manifest.web_root, testPath)
              } else {
                testPath = manifest.web_root
              }
            }
            // attempt lookup
            try {
              entry = await archive.stat(testPath)
              entry.path = testPath;
            } catch (e) {
              console.error('stat error', testPath, e);
            }
          }

          if (!isFolder) {
            await tryStat(filePath)
            if (entry && entry.isDirectory()) {
              entry = null;
              await tryStat(`${filePath}/${search}`);
              if (entry && entry.isDirectory()) {
                isFolder = true;
                filePath = `${filePath}/${search}`;
                entry = null;
              }
            }
          }

          if (isFolder) {
            await tryStat(filePath + 'index.html')
            await tryStat(filePath + 'index.md')
            await tryStat(filePath)
          } else {
            await tryStat(filePath)
            await tryStat(filePath + '.html') // fallback to .html
          }

          if (entry && entry.isDirectory()) {
            yield responseText(`Directory ${entry.path}`);
            return;
          }

          if (!entry) {
            // check for a fallback page
            if (manifest && manifest.fallback_page) {
              await tryStat(manifest.fallback_page)
            }

            if (!entry) {
              yield responseText(`Error: Not found`);
              return;
            }
          }

          const stream = archive._archive.createReadStream(entry.path, { start: 0 });
          const streamIt = new StreamIterator(stream);
          while (true) {
            const next = await streamIt.next();
            if (!next) {
              break;
            }
            yield next.buffer;
          }
        } catch (e) {
          console.error(`handler error: ${request}`, e);
          yield responseText(`Error: ${e}`);
        }
      })()
    };
  },
}