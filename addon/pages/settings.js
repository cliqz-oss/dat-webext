async function getConfig() {
  return browser.runtime.sendMessage({ action: 'getConfig' });
}

async function setConfig(conf) {
  browser.runtime.sendMessage({ action: 'setConfig', args: [conf] });
}

const checkbox = {
  announce: document.getElementById('setting-announce'),
  upload: document.getElementById('setting-upload'),
};
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

const i18Attr = 'data-i18n-id';
document.querySelectorAll(`[${i18Attr}]`).forEach((elem) => {
  const key = elem.getAttribute(i18Attr);
  const text = browser.i18n.getMessage(key);  
  elem.textContent = text;
});
