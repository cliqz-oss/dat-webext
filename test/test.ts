import * as parseUrl from 'parse-dat-url';
import DatLibrary from '../background/library';
import DatHandler from '../background/protocol';

const { test } = browser.test;

// we have to register the protocol so the URL implementation
// recognises dat:// as a protocol.
browser.protocol.registerProtocol('dat', (request) => ({
  content: () => {}
}));

async function setupLibrary() {
  const library = new DatLibrary();
  await library.init();
  return library;
}

test('Dat Network', async (assert) => {
  console.log('start test');
  const library = await setupLibrary();
  console.log(library);
  const archive = await library.getArchive('datproject.org');
  console.log(archive);
  assert.ok(!(await archive.getInfo()).isOwner);
  assert.ok((await archive.readdir('/')).includes('index.html'));
});

test('Protocol handler', async (assert) => {
  const library = await setupLibrary();
  const handler = new DatHandler(library.getArchiveFromUrl.bind(library));

  const resolveUrl = async (url: string) => {
    const { pathname, version } = parseUrl(url);
    const { path } = await handler.resolvePath('dat://sammacbeth.eu+26/', pathname, parseInt(version));
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
});
