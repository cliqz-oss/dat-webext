const DatArchiveWeb = require('dat-archive-web');
const DatGatewayIntroducer = require('@sammacbeth/discovery-swarm/web/dat-gateway');
const TCPTransport = require('@sammacbeth/discovery-swarm/webext/tcp-transport');
const LanDiscovery = require('@sammacbeth/discovery-swarm/webext/service-discovery');
const resolveName = require('./dns');
const Swarm = require('./network');

const gateways = [
  'ws://macbeth.cc:3000',
];

const swarmConfig = {
  sparse: true,
  introducers: [
    new DatGatewayIntroducer(gateways),
    new LanDiscovery({ announce: true }),
  ],
  transport: {
    tcp: new TCPTransport(),
  },
}

const swarm = new Swarm(swarmConfig);
swarm.listen();

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
    swarm.add(this._archive);
  }

  static async resolveName(url) {
    return resolveName(url);
  }

  close() {
    super.close();
    swarm.remove(this._archive);
  }
}

module.exports = {
  DatArchive,
  initManager: (library) => {
    const manager = new Manager(library);
    DatArchive.setManager(manager);
  }
};