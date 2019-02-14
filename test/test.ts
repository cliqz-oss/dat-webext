import DatLibrary from '../background/library';

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
