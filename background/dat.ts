import * as DatArchiveWeb from '@sammacbeth/dat-archive-web';
import * as disc from 'discovery-swarm';
import * as hypercoreProtocol from 'hypercore-protocol';
import * as swarmDefaults from 'dat-swarm-defaults';
import resolveName from './dns';
import DatLibrary from './library';

class MultiSwarm {

  swarm: any
  archives: Map<string, any>

  constructor() {
    this.swarm = disc(swarmDefaults({
      hash: false,
      stream: this.replicate.bind(this),
    }));
    this.archives = new Map();
  }

  listen(port?) {
    return this.swarm.listen(port);
  }

  add(archive) {
    archive.ready(() => {
      const key = archive.discoveryKey.toString('hex');
      this.archives.set(key, archive);
      this.swarm.join(archive.discoveryKey, {
        key: archive.key,
      });
    });
  }

  remove(archive) {
    const key = archive.discoveryKey.toString('hex');
    this.archives.delete(key);
    this.swarm.leave(archive.discoveryKey);
  }

  replicate(opts) {
    const stream = hypercoreProtocol({
      live: true,
      id: this.swarm.id,
      encrypt: true
    });

    const add = (dk) => {
      const key = dk.toString('hex');
      if (!this.archives.has(key)) {
        return;
      }
      const archive = this.archives.get(key);
      archive.replicate({
        live: true,
        stream,
      });
    };

    stream.on('feed', add);
    if (opts.channel) {
      add(opts.channel);
    }

    return stream;
  }

  destroy() {
    this.swarm.destroy();
  }
}

const swarm = new MultiSwarm();
swarm.listen();
window.addEventListener('unload', () => {
  swarm.destroy();
});

const DefaultManager = DatArchiveWeb.DatArchive.DefaultManager;

class Manager extends DefaultManager {

  port: number
  library: DatLibrary

  constructor(library) {
    super();
    this.port = 443;
    this.library = library;
  }

  async getStorage(key, secretKey) {
    return this.library.getStorage(key, secretKey);
  }

  onAddArchive(key, secretKey, options) {
    console.log('add archive', key, secretKey, options);
  }

  replicate (key) {
  }

  async resolveName(url) {
    return resolveName(url);
  }

  construct(args) {
    return new DatArchive(args);
  }

}

export class DatArchive extends DatArchiveWeb.DatArchive {

  _replicate () {
    swarm.add(this._archive);
  }

  static async resolveName(url) {
    return resolveName(url);
  }

  close() {
    this.closed = true;
    swarm.remove(this._archive);
    this._archive.close();
  }
}

export function initManager(library) {
  const manager = new Manager(library);
  DatArchive.setManager(manager);
}