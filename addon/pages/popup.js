const { api } = browser.extension.getBackgroundPage();

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

  document.getElementById('dat-fork').addEventListener('click', () => {
    api.privateApi.forkAndLoad(tab.url, {})
  });
  document.getElementById('dat-download').addEventListener('click', () => {
    api.privateApi.download(tab.url)
  });

  const { title, description, peers, size } = await api.api.getInfo(tab.url);
  document.getElementById('dat-title').innerText = title;
  document.getElementById('dat-desc').innerText = description;
  document.getElementById('dat-peers').innerText = `${peers} peers | ${getSize(size)} on disk`;
});
