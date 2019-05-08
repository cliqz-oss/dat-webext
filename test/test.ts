import * as parseUrl from 'parse-dat-url';
import DatLibrary from '../background/library';
import DatHandler from '../background/protocol';
import DatApi from '../background/api';

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

const library = new DatLibrary();
const protocolHandler = new DatHandler(library.getArchiveFromUrl.bind(library));
const api = new DatApi(library, { disablePrompts: true });
const ready = library.init();
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
  await ready;
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
  await ready;
  const archive = await library.getArchive('datproject.org');
  assert.ok(!(await archive.getInfo()).isOwner);
  assert.ok((await archive.readdir('/')).includes('index.html'));
}, 30000);

testWithTimeout('Protocol handler', async (assert) => {
  await ready;

  const resolveUrl = async (url: string) => {
    const { pathname, version } = parseUrl(url);
    const { path } = await protocolHandler.resolvePath('dat://sammacbeth.eu+26/', pathname, parseInt(version));
    return path;
  }

  let testDatAddress = '70fa7fd2670f48226fa3877e4d0b23d1a9124b086efe8831c5f8d6450aadc47c'
  assert.equal(await resolveUrl(`dat://${testDatAddress}+28/`), '/index.html');
  assert.equal(await resolveUrl(`dat://${testDatAddress}+28/posts`), '/posts/index.html');
  assert.equal(await resolveUrl(`dat://${testDatAddress}+27/posts`), '/posts.html');
  try {
    await resolveUrl(`dat://${testDatAddress}+28/posts.html`)
    assert.fail('Expected NOT_FOUND error');
  } catch (e) {
    assert.equal(e.message, 'NOT_FOUND');
  }
}, 60000);
