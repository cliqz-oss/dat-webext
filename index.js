const protocolHandler = require('./protocol');
const DatLibrary = require('./library');
const dat = require('./dat');
const DatApi = require('./api');

const library = new DatLibrary();
library.init();
dat.initManager(library);
global.library = library;

const getArchive = library.getArchive.bind(library);
const getArchiveFromUrl = library.getArchiveFromUrl.bind(library);

browser.protocol.registerProtocol('dat', (request) => {
  return protocolHandler.handleRequest(request, { getArchive });
});

const api = new DatApi('cliqz@cliqz.com', getArchiveFromUrl);
global.api = api;

// load my own archives
library.getArchives().filter(a => a.isOwner).forEach((a) => library.getArchive(a.key));

// manage open archives
setInterval(() => {
  const archives = library.getArchives();
  // get archives which have active listeners
  const activeStreams = new Set();
  api.listenerStreams.forEach(({ key }) => activeStreams.add(key));

  const closeCutoff = Date.now() - (1000 * 60 * 10)
  archives.filter((a) => a.open && !a.isOwner && !activeStreams.has(a.key) && a.lastUsed < closeCutoff).forEach((a) => {
    library.closeArchive(a.key);
  });
  const calculateUsage = (type) => type ? (type.downloaded / type.length) * type.byteLength : 0;
  const mb = 1024 * 1024;
  const usage = archives
    .filter(a => !a.isOwner)
    .map(a => [a.key, (calculateUsage(a.metadata) + calculateUsage(a.content)) / mb]);
  const totalUsage = usage.reduce((acc, a) => acc + (a[1] || 0), 0);
  console.log('data usage', usage, totalUsage);
  // prune data
  if (totalUsage > 10) {
    const pruneable = archives
      .filter(a => !a.open && !a.isOwner && !activeStreams.has(a.key))
      .sort((a, b) => a.lastUsed - b.lastUsed);
    console.log('over limit', pruneable);
    if (pruneable.length > 0) {
      console.log('prune archive', pruneable[0].key);
      library.deleteArchive(pruneable[0].key);
    }
  }
}, 10000);