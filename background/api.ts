import Spanan from 'spanan';
import { DatArchive, DatManifest, SelectArchiveOptions } from './dat';
import dialog from './dialog';
import DatLibrary from './library';
import { IDatInfo } from './db';

interface CloseableEventTarget extends EventTarget {
  close(): void
}

interface ApiOptions {
  disablePrompts?: boolean
}

class DatApi {

  listenerStreams: Map<number, {
    stream: CloseableEventTarget
    key: string
  }>
  privateApi: {
    create(opts: DatManifest): Promise<string>
    fork(url: string, opts: DatManifest): Promise<string>
    dialogResponse(message: any): void
    getArchive(url: string): Promise<DatArchive>
    listLibrary(): Promise<IDatInfo[]>
    download(url: string): Promise<void>
    forkAndLoad(url: string, opts: DatManifest): Promise<void>
  }
  api: any
  disablePrompts: boolean

  constructor(library: DatLibrary, opts: ApiOptions = {}) {
    const disablePrompts = !!opts.disablePrompts || !browser.windows;
    const getArchiveFromUrl = library.getArchiveFromUrl.bind(library);
    this.listenerStreams = new Map();
    const listenerStreams = this.listenerStreams
    let streamCtr = 0;
    const apiWrapper = new Spanan((message) => {
      browser.processScript.sendMessage(message);
    });
    const events = apiWrapper.createProxy();

    const privateApi = this.privateApi = {
      async create(opts: DatManifest) {
        const archive = await library.createArchive(opts);
        return archive.url;
      },
      async fork(url, opts) {
        const addr = await library.dns.resolve(url);
        const archive = await library.forkArchive(addr, opts);
        return archive.url;
      },
      async dialogResponse(message) {
        dialog.onMessage(message);
      },
      async getArchive(url) {
        return await getArchiveFromUrl(url);
      },
      async listLibrary() {
        return library.getLibraryArchives();
      },
      async download(url: string) {
        const archive = await getArchiveFromUrl(url);
        await archive.download();
      },
      async forkAndLoad(url: string, opts: DatManifest) {
        const addr = await dialog.open({
          action: 'fork',
          opts: {
            url,
            title: opts.title,
            description: opts.description,
          }
        });
        browser.tabs.create({
          active: true,
          url: addr,
        });
      }
    }

    this.api = {
      resolveName(name: string) {
        return library.dns.resolve(name);
      },
      async create(opts: DatManifest = {}) {
        if (disablePrompts) {
          return privateApi.create(opts);
        }
        return await dialog.open({
          action: 'create',
          opts: {
            title: opts.title,
            description: opts.description,
          }
        });
      },
      async fork(url: string, opts: DatManifest = {}) {
        if (disablePrompts) {
          return privateApi.fork(url, opts);
        }
        return await dialog.open({
          action: 'fork',
          opts: {
            url,
            title: opts.title,
            description: opts.description,
          }
        });
      },
      async selectArchive(opts: SelectArchiveOptions = {}) {
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
        const listing = await archive.readdir(path, opts);
        if (opts && opts.stat) {
          // serialise stat
          return listing.map(({ name, stat }) => {
            stat._isDirectory = stat.isDirectory();
            stat._isFile = stat.isFile();
            return { name, stat };
          });
        }
        return listing;
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
        const key = archive._dataStructure.key.toString('hex');
        const streamId = streamCtr++;
        const stream = archive.watch(pattern);
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
            stream.removeEventListener(response, () => {});
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
      apiWrapper.handleMessage(message);
    });
  }
};

export default DatApi;
