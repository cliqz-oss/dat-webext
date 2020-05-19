import * as parseUrl from 'parse-dat-url';
import DatLibrary from '../background/library';
import DatHandler from '../background/protocol';
import DatApi from '../background/api';
import DatDb from '../background/db';
import nodeFactory from '../background/dat';
import DatDNS from '../background/dns';

const { test } = browser.test;

const testWithTimeout = (name: string, testFn: (assert: browser.test.Assert) => Promise<void>, timeout: number) => {
  return test(name, async (assert) => {
    const timedout = new Promise((_, rej) => setTimeout(() => rej(`Timed out after ${timeout}ms`), timeout));
    const runningTest = testFn(assert);
    try {
      await Promise.race([runningTest, timedout]);
    } catch (e) {
      assert.fail(`${name} failed to complete: ${e.toString()}`);
    }
  });
};

// we have to register the protocol so the URL implementation
// recognises dat:// as a protocol.

const node = nodeFactory({
  announceEnabled: false,
  wrtcEnabled: true,
  uploadEnabled: true,
});
const db = new DatDb();
const library = new DatLibrary(db, node);
const dns = new DatDNS(db);
const protocolHandler = new DatHandler(dns, node[0]);
const api = new DatApi(node[0], dns, library, { disablePrompts: true });
browser.protocol.registerProtocol('dat', (request) => {
  return protocolHandler.handleRequest(request);
});
browser.processScript.setAPIScript(browser.runtime.getURL('web-api.js'));

let pendingEvents = [];
const datArchiveTestListener = new Promise((resolve) => {
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'test') {
      if (message.event[0] === 'end') {
        resolve();
      }
      pendingEvents.push(message.event);
    }
  });
});

testWithTimeout('DatArchive API', async (assert) => {
  const parseTestEvent = ([status, e]) => {
    if (status === 'fail') {
      assert.fail(e.fullTitle);
    } else if (status === 'pass') {
      assert.pass(e.fullTitle);
    };
  };
  pendingEvents.forEach(parseTestEvent);
  pendingEvents = [];
  await datArchiveTestListener;
  pendingEvents.forEach(parseTestEvent);
}, 120000);

testWithTimeout('Dat Network', async (assert) => {
  const archive = await api.privateApi.getArchive('dat://dat.foundation');
  assert.ok(!(await archive.getInfo()).isOwner);
  assert.ok((await archive.readdir('/')).includes('index.html'));
}, 30000);

testWithTimeout('Dat2 Network', async (assert) => {
  const dat = await node[1].getDat('a8109b835d27c30ad4d55b321dd7c4032c037eaf1f6f2b00de7b03b5a6cc504a');
  await dat.ready;
  assert.ok(!dat.drive.writable);
  const files: string[] = await new Promise((resolve, reject) => {
    dat.drive.readdir('/', (err, files) => {
      if (err) return reject(err);
      resolve(files);
    })
  });
  assert.ok(files.includes('index.html'));
}, 30000);

test('Dat DNS', async (assert) => {
  const addr = await dns.resolve('dat://sammacbeth.eu');
  assert.equal(addr, '41f8a987cfeba80a037e51cc8357d513b62514de36f2f9b3d3eeec7a8fb3b5a5');
})
