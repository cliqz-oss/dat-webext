import * as parseUrl from 'parse-dat-url';
import DatLibrary from '../background/library';
import DatHandler from '../background/protocol';
import DatApi from '../background/api';
import DatDb from '../background/db';

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

const db = new DatDb();
const library = new DatLibrary(db);
const protocolHandler = new DatHandler(library.getArchiveFromUrl.bind(library));
const api = new DatApi(library, { disablePrompts: true });
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
}, 60000);

testWithTimeout('Dat Network', async (assert) => {
  const archive = await library.getArchive('sammacbeth.eu');
  assert.ok(!(await archive.getInfo()).isOwner);
  assert.ok((await archive.readdir('/')).includes('index.html'));
}, 30000);

testWithTimeout('Protocol handler', async (assert) => {
  const resolveUrl = async (url: string) => {
    const { pathname, version } = parseUrl(url);
    const { path } = await protocolHandler.resolvePath(url, pathname, parseInt(version));
    return path;
  }

  let testDatAddress = '41f8a987cfeba80a037e51cc8357d513b62514de36f2f9b3d3eeec7a8fb3b5a5'
  assert.equal(await resolveUrl(`dat://${testDatAddress}+33/`), '/index.html');
  assert.equal(await resolveUrl(`dat://${testDatAddress}+33/posts`), '/posts/index.html');
  assert.equal(await resolveUrl(`dat://${testDatAddress}+32/posts`), '/posts.html');
  try {
    await resolveUrl(`dat://${testDatAddress}+33/posts.html`)
    assert.fail('Expected NOT_FOUND error');
  } catch (e) {
    assert.equal(e.message, 'NOT_FOUND');
  }
}, 60000);


test('Dat DNS', async (assert) => {
  const addr = await library.dns.resolve('dat://sammacbeth.eu');
  assert.equal(addr, '41f8a987cfeba80a037e51cc8357d513b62514de36f2f9b3d3eeec7a8fb3b5a5');
})
