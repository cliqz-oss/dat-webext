import DatHandler from './protocol';
import DatLibrary from './library';
import DatApi from './api';
import DatDb from './db';

browser.processScript.setAPIScript(browser.runtime.getURL('web-api.js'));

// Once the size of stored archives exceeds this we will start pruning old data
const CACHE_SIZE_MB = 50;

const db = new DatDb();
const library = new DatLibrary(db);

(<any>window).library = library;

window.addEventListener('beforeunload', () => {
  library.api.shutdown();
})

const getArchiveFromUrl = library.getArchiveFromUrl.bind(library);

const protocolHandler = new DatHandler(getArchiveFromUrl);
browser.protocol.registerProtocol('dat', (request) => {
  return protocolHandler.handleRequest(request);
});

const api = new DatApi(library);
(<any>window).api = api;

library.db.library.where('seedingMode').above(0).each(({ key }) => {
  console.log('load', key);
  library.getArchive(key);
});

// manage open archives
setInterval(async () => {
  const archives = await library.db.library.toArray();
  // get archives which have active listeners
  const activeStreams = new Set();
  api.listenerStreams.forEach(({ key }) => activeStreams.add(key));
  const tabs = await browser.tabs.query({});
  const openDatUrls = new Set(await Promise.all(
    tabs
      .filter(({ url }) => url.startsWith('dat://'))
      .map(({ url }) => library.dns.resolve(url)))
  );

  // close dats we're not using anymore
  archives.filter(a => 
    library.api.dats.has(a.key) &&
    library.api.dats.get(a.key).isSwarming &&
    a.seedUntil < Date.now() &&
    !a.isOwner && 
    a.seedingMode === 0 && 
    !activeStreams.has(a.key) &&
    !openDatUrls.has(a.key))
  .forEach((a) => {
    console.log('close archive', a.key);
    library.closeArchive(a.key);
  });

  let totalUsage = archives.reduce((acc, { size }) => acc + size, 0) / 1e6;
  // prune data
  if (totalUsage > CACHE_SIZE_MB) {
    const pruneable = archives
      .filter(a => !library.api.dats.has(a.key) && !a.isOwner && !activeStreams.has(a.key))
      .sort((a, b) => a.lastUsed - b.lastUsed);
    if (pruneable.length > 0) {
      console.log('prune archive', pruneable[0].key);
      library.deleteArchive(pruneable[0].key);
    }
  }
}, 60000);

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.startsWith('dat://')) {
    browser.pageAction.show(tabId);
  } else {
    browser.pageAction.hide(tabId);
  }
});
