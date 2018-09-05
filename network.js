const disc = require('@sammacbeth/discovery-swarm');
const protocol = require('hypercore-protocol');

class MultiSwarm {
  constructor(swarmConfig) {
    this.opts = Object.assign({
      hash: false,
      stream: this.replicate.bind(this),
    }, swarmConfig);
    this.swarm = disc(this.opts);
    this.archives = new Map();
  }

  listen(port) {
    return this.swarm.listen(port);
  }

  add(archive) {
    const key = archive.discoveryKey.toString('hex');
    this.archives.set(key, archive);
    this.swarm.join(archive.discoveryKey, {
      key: archive.key,
    });
  }

  remove(archive) {
    const key = archive.discoveryKey.toString('hex');
    this.archives.delete(key);
    this.swarm.leave(archive.discoveryKey);
  }

  replicate(opts) {
    const stream = protocol({
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
    if (opts.channel || opts.discoveryKey) {
      add(opts.channel || opts.discoveryKey);
    }

    return stream;
  }

  destroy() {
    this.swarm.destroy();
  }
}

module.exports = MultiSwarm;