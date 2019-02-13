const { api, library } = browser.extension.getBackgroundPage();

async function getTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

const units = ['bytes', 'kb', 'mb', 'gb'];

function getSize(size, unit = 0) {
  if (size > 1024 && unit < units.length - 1) {
    return getSize(size / 1024, unit + 1);
  }
  return `${Math.round(size * 10) / 10} ${units[unit]}`;
}

getTab().then(async (tab) => {
  const peerInfo = document.getElementById('dat-peers');
  const seedingButton = document.getElementById('dat-switch-seeding');

  document.getElementById('dat-fork').addEventListener('click', () => {
    api.privateApi.forkAndLoad(tab.url, {})
  });
  document.getElementById('dat-download').addEventListener('click', () => {
    api.privateApi.download(tab.url)
  });

  const { title, description, peers, size, key, isOwner } = await api.api.getInfo(tab.url);
  const { forceSeeding } = await library.getArchiveState(key);

  document.getElementById('dat-title').innerText = title;
  if (description) {
    document.getElementById('dat-desc').innerText = description;
  }
  peerInfo.innerText = `${peers} peers | ${getSize(size)} on disk`;
  if (isOwner) {
    peerInfo.innerHTML += ' | <span class="tag is-info">Writable</span>';
  }
  if (isOwner || forceSeeding) {
    seedingButton.setAttribute('checked', 'checked');
    if (isOwner) {
      seedingButton.setAttribute('disabled', true);
    }
  }

  seedingButton.addEventListener('change', async (ev) => {
    const state = await library.getArchiveState(key);
    state.forceSeeding = seedingButton.checked;
    library._persistArchives();
  })
});
