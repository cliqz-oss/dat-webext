import DatHandler from './protocol';
import DatLibrary from './library';
import DatApi from './api';
import DatDb from './db';
import nodeFactory from './dat';
import DatDNS from './dns';
import Experiment from './experiment';
import { getConfig, setConfig } from './config';

const node = nodeFactory();
const db = new DatDb();
const library = new DatLibrary(db, node);
const dns = new DatDNS(db);
const protocolHandler = new DatHandler(dns, node);

browser.processScript.setAPIScript(browser.runtime.getURL('web-api.js'));

// Once the size of stored archives exceeds this we will start pruning old data
const CACHE_SIZE_MB = 50;

const win = <any>window;
win.library = library;
win.getConfig = getConfig;
win.setConfig = setConfig;

window.addEventListener('beforeunload', () => {
  node.shutdown();
});

browser.protocol.registerProtocol('dat', (request) => {
  return protocolHandler.handleRequest(request);
});

// Handler for messages from other contexts
browser.runtime.onMessage.addListener((message, sender) => {
  try {
    const { action, args } = message;
    if (action === 'getConfig' && sender.id == 'dat@cliqz.com') {
      return getConfig();
    } else if (action === 'setConfig' && sender.id == 'dat@cliqz.com') {
      return setConfig(args[0]);
    }
    return {
      error: 'Unknown message action',
    };
  } catch (e) {
    return;
  }
});

const api = new DatApi(node, dns, library);
win.api = api;

library.db.library
  .where('seedingMode')
  .above(0)
  .each(({ key }) => {
    console.log('load', key);
    node.getDat(key, { persist: true });
  });

// manage open archives
setInterval(async () => {
  const archives = await library.db.library.toArray();
  // get archives which have active listeners
  const activeStreams = new Set();
  api.listenerStreams.forEach(({ key }) => activeStreams.add(key));
  const tabs = await browser.tabs.query({});
  const openDatUrls = new Set(
    await Promise.all(
      tabs.filter(({ url }) => url.startsWith('dat://')).map(({ url }) => dns.resolve(url)),
    ),
  );

  // close dats we're not using anymore
  archives
    .filter(
      (a) =>
        library.api.dats.has(a.key) &&
        library.api.dats.get(a.key).isSwarming &&
        a.seedUntil < Date.now() &&
        !a.isOwner &&
        a.seedingMode === 0 &&
        !activeStreams.has(a.key) &&
        !openDatUrls.has(a.key),
    )
    .forEach((a) => {
      console.log('close archive', a.key);
      library.closeArchive(a.key);
    });

  let totalUsage =
    archives.filter(({ size }) => !isNaN(size)).reduce((acc, { size }) => acc + size, 0) / 1e6;
  // prune data
  if (totalUsage > CACHE_SIZE_MB) {
    const pruneable = archives
      .filter((a) => !library.api.dats.has(a.key) && !a.isOwner && !activeStreams.has(a.key))
      .sort((a, b) => a.lastUsed - b.lastUsed);
    if (pruneable.length > 0) {
      console.log('prune archive', pruneable[0].key);
      library.deleteArchive(pruneable[0].key);
    }
  }
}, 60000);

const experiment = new Experiment(node);
experiment.start();
win.experiment = experiment;
