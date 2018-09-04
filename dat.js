const Websocket = require('websocket-stream')
const DatArchiveWeb = require('dat-archive-web');
const pump = require('pump');
const resolveName = require('./dns');

const gateways = [
  'wss://dat-gateway.now.sh',
  'ws://macbeth.cc:3000',
];

const DefaultManager = DatArchiveWeb.DefaultManager;

class Manager extends DefaultManager {
  constructor(library) {
    super(gateways[0].replace('wss:', 'https:').replace('ws:', 'http:'));
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
    const gateway = gateways[Math.floor(Math.random() * gateways.length)];
    const proxyURL = `${gateway}/${key}`
    const socket = Websocket(proxyURL)
    return socket
  }

  async resolveName(url) {
    return resolveName(url);
  }

}

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

  static async resolveName(url) {
    return resolveName(url);
  }
}

module.exports = {
  DatArchive,
  initManager: (library) => {
    const manager = new Manager(library);
    DatArchive.setManager(manager);
  }
};