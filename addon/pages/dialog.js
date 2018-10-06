
const { api } = browser.extension.getBackgroundPage();

// read options for dialog from url
const message = JSON.parse(decodeURIComponent(document.location.hash).substring(1));
const { action, opts, id } = message;
console.log(message)
// make action visible
document.getElementById(action).style.display = 'block';

// register cancel listeners
Array.prototype.forEach.call(document.getElementsByClassName('cancel'), (btn) => {
  btn.onclick = async () => {
    api.privateApi.dialogResponse({
      dialogId: id,
      error: 'User aborted',
    });
  };
});

function onSubmit(cb, formId, buttonId) {
  let submitted = false;
  const onSubmit = () => {
    if (submitted) {
      return false;
    }
    console.log('submit');
    submitted = true;
    cb().catch((error) => {
      api.privateApi.dialogResponse({
        dialogId: id,
        error: error.toString(),
      });
    });
    return false;
  };
  document.getElementById(formId).onsubmit = onSubmit;
  document.getElementById(buttonId).click = onSubmit;
}

// fill fields from input options
async function setupForm() {
  if (action === 'create') {
    const title = document.getElementById('create-title');
    const desc = document.getElementById('create-desc');
    title.setAttribute('value', opts.title || '');
    desc.setAttribute('value', opts.description || '');
    onSubmit(() => {
      return api.privateApi.create({
        title: title.value,
        desc: desc.value,
      }).then(url => (
        api.privateApi.dialogResponse({
          dialogId: id,
          result: url,
        })
      ));
    }, 'create-form', 'create-submit');
  } else if (action === 'fork') {
    document.getElementById('fork-url').innerText = opts.url;
    const source = await api.privateApi.getArchive(opts.url);
    const info = await source.getInfo({ timeout: 30000 });
    const download = source.download('/').catch(() => {});
    if (info.title) {
      document.getElementById('fork-message').innerText = `Fork '${info.title}'`;
    }
    const title = document.getElementById('fork-title');
    const desc = document.getElementById('fork-desc');
    const btnFork = document.getElementById('fork-submit');
    title.setAttribute('value', opts.title || info.title || '');
    desc.setAttribute('value', opts.description || info.description || '');
    onSubmit(async () => {
      title.setAttribute('disabled', true);
      desc.setAttribute('disabled', true);
      btnFork.setAttribute('disabled', true);
      document.getElementById('force-fork').style.display = 'block';
      const force = new Promise((resolve) => {
        document.getElementById('fork-submit-now').click = resolve;
      });
      await Promise.race([download, force]);
      const forkUrl = await api.privateApi.fork(opts.url, {
        title: title.value,
        description: desc.value,
        skipUndownloadedFiles: true,
      });
      return api.privateApi.dialogResponse({
        dialogId: id,
        result: forkUrl,
      });
    }, 'fork-form', 'fork-submit');
  } else if (action === 'selectArchive') {
    const library = await api.privateApi.listLibrary(opts.filters);
    const archiveList = document.getElementById('archives');
    library.forEach(async ({ key, title, description }) => {
      const template = document.createElement('template');
      template.innerHTML = `<a class="list-group-item list-group-item-action flex-column align-items-start" href="#">
                <h5>${title || 'unnamed'}</h5>
                <small>dat://${key.substring(0, 5)}...${key.substring(60)}</small>
                <p>${description || ''}</p>
            </a>`;
      const elem = template.content.firstChild;
      archiveList.appendChild(elem);
      elem.onclick = () => {
        api.privateApi.dialogResponse({
          dialogId: id,
          result: key,
        });
      };
    });
  }
}

setupForm();