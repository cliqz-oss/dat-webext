const Websocket = require('websocket-stream')
const DatArchiveWeb = require('dat-archive-web');
const parseUrl = require('parse-dat-url');
const pump = require('pump');

const datUrlMatcher = /^[0-9a-f]{64}$/;

const gateways = [
  'ws://macbeth.cc:3000',
  'ws://gateway.mauve.moe:3000',
  'wss://pamphlets.me',
];

const DefaultManager = DatArchiveWeb.DefaultManager;

class Manager extends DefaultManager {
  constructor(library) {
    super(gateways[0]);
    this.library = library;
    this.lookupCache = new Map();
  }

  async getStorage(key, secretKey) {
    return this.library.getStorage(key, secretKey);
  }

  onAddArchive(key, secretKey, options) {
    console.log('add archive', key, secretKey, options);
  }

  replicate (key) {
    const gateway = gateways[Math.floor(Math.random() * gateways.length)];
    const proxyURL = `${gateway}/${key}`
    const socket = Websocket(proxyURL)
    return socket
  }

  async resolveName(url) {
    const { host } = parseUrl(url);
    if (datUrlMatcher.test(host)) {
      return host;
    }
    // check for cached lookup
    const cached = this.lookupCache.get(host);
    if (cached) {
      if (cached.expires > Date.now()) {
        return cached.address;
      }
      this.lookupCache.delete(host);
    }
    // check via fetch
    try {
      const protocol = this.secure ? 'https:' : 'http:'
      const proxyURL = `${protocol}//${this.hostname}:${this.port}/${host}/.well-known/dat`
      const response = await fetch(proxyURL, {
        credentials: 'omit'
      });
      const lookup = await response.text();
      let [addr, ttl] = lookup.split('\n');
      if (addr.startsWith('dat://')) {
        addr = addr.substring(6);
        ttl = ttl.startsWith('TTL=') || ttl.startsWith('ttl=') ? parseInt(ttl.substring(4)) : 3600;
        this.lookupCache.set(host, { address: addr, expires: Date.now() + ttl });
        return addr;
      }
    } catch(e) {
      console.error('lookup error', e);
    }
    return null;
  }
}

// TODO: override replication
class DatArchive extends DatArchiveWeb {
  _replicate () {
    const archive = this._archive;
    const key = archive.key.toString('hex');

    const stream = DatArchive._manager.replicate(key)

    pump(stream, archive.replicate({
      live: true,
      upload: true
    }), stream, (err) => {
      // console.error(err)
      if (this.closed) {
        return
      }
      if (!this.replicationErrors) {
        this.replicationErrors = [];
        this.replicationBackOff = 100;
      }
      this.replicationErrors.push(Date.now());
      if (this.replicationErrors.length > 5) {
        this.replicationErrors.shift();
      }
      if (Date.now() - this.replicationErrors[0] > this.replicationBackOff * 5) {
        this.replicationBackOff *= 2;
      }
      console.log('replication backoff', this.replicationBackOff, this.replicationErrors.length, Date.now() - this.replicationErrors[0]);
      setTimeout(() => this._replicate(), this.replicationBackOff);
    })

    this._stream = stream

    return stream
  }
}

module.exports = {
  DatArchive,
  initManager: (library) => {
    const manager = new Manager(library);
    DatArchive.setManager(manager);
  }
};