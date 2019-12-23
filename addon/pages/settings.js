
const { getConfig, setConfig } = browser.extension.getBackgroundPage();

const checkbox = {
  announce: document.getElementById('setting-announce'),
  upload: document.getElementById('setting-upload'),
}
let lock = Promise.resolve();

getConfig().then((conf) => {
  checkbox.announce.checked = !!conf.announceEnabled;
  checkbox.upload.checked = !!conf.uploadEnabled;
});

checkbox.announce.addEventListener('change', async () => {
  await lock;
  lock = getConfig().then((conf) => {
    if (checkbox.announce.checked !== conf.announceEnabled) {
      conf.announceEnabled = !!checkbox.announce.checked;
      return setConfig(conf);
    }
  });
});

checkbox.upload.addEventListener('change', async () => {
  await lock;
  lock = getConfig().then((conf) => {
    if (checkbox.upload.checked !== conf.uploadEnabled) {
      conf.uploadEnabled = !!checkbox.announce.checked;
      conf.wrtcEnabled = conf.uploadEnabled;
      return setConfig(conf);
    }
  });
});

