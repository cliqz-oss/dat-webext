import * as parseUrl from 'parse-dat-url';
import * as pda from 'pauls-dat-api';
import { join as joinPaths } from 'path';
import * as mime from 'mime';
import { DNSLookupFailed } from './errors';
import { DatArchive } from './dat';


function timeoutWithError(ms, errorCtr) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(errorCtr());
    }, ms);
  })
}

const ERROR = {
  ARCHIVE_LOAD_TIMEOUT: 'ARCHIVE_LOAD_TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
  DIRECTORY: 'DIRECTORY',
}

class DatHandler {

  getArchiveFromUrl: (url: string, version: number) => Promise<any>

  constructor(getArchiveFromUrl) {
    this.getArchiveFromUrl = getArchiveFromUrl;
  }

  async loadArchive(url: string, version: number, timeout = 30000): Promise<DatArchive> {
    const loadArchive = this.getArchiveFromUrl(url, version);
    await Promise.race([
      loadArchive,
      timeoutWithError(timeout, () => new Error(ERROR.ARCHIVE_LOAD_TIMEOUT))
    ]);
    return loadArchive;
  }

  async resolvePath(url: string, pathname: string, version: number) {
    const timeoutAt = Date.now() + 30000;
    const archive = await this.loadArchive(url, version);
    const manifest = await pda.readManifest(archive._checkout).catch(_ => ({ }));
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
    if (await tryStat(joinPaths(root, `${path}.html`))) {
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

  handleRequest(request: browser.protocol.Request): Response {
    const self = this;
    const { host, pathname, version } = parseUrl(request.url);
    const body = new ReadableStream({
      async start(controller) {
        try {
          const { archive, path } = await self.resolvePath(request.url, pathname, parseInt(version));
          const stream = archive._checkout.createReadStream(path, { start: 0 });
          stream.on('close', () => {
            controller.close();
          });
          stream.on('end', () => {
            controller.close();
          });
          stream.on('error', (e) => {
            controller.error(e);
          });
          stream.on('data', (chunk) => {
            controller.enqueue(chunk);
          });
        } catch (e) {
          if (e instanceof DNSLookupFailed) {
            controller.enqueue(`Dat DNS Lookup failed for ${e.message}`);
          } else if (e.message === ERROR.ARCHIVE_LOAD_TIMEOUT) {
            controller.enqueue('Unable locate the Dat archive on the network.');
          } else if (e.message === ERROR.NOT_FOUND) {
            controller.enqueue(`Not found: ${e.toString()}`);
          } else if (e.message === ERROR.DIRECTORY) {
            const req = await fetch('/pages/directory.html');
            const contents = await req.text();
            controller.enqueue(contents);
          } else {
            console.error(e);
            controller.enqueue(`Unexpected error: ${e.toString()}`);
          }
          controller.close();
        }
      }
    });
    return new Response(body, {
      headers: {
        "content-type": mime.getType(decodeURIComponent(pathname)) || 'text/html'
      }
    });
  }
}

export default DatHandler;
