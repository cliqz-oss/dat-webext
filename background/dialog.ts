
let dialogCtr = 1;
const dialogs = new Map();

type DialogOpenMessage = {
  id?: number
  action: string
  opts: {}
}

type DialogResponse = {
  dialogId: number
  result?: string
  error?: string
}

export default {
  async open(message: DialogOpenMessage): Promise<string> {
    message.id = dialogCtr++;
    const win = await browser.windows.create({
      allowScriptsToClose: true,
      type: 'popup',
      url: `/pages/dialog.html#${JSON.stringify(message)}`,
      width: 500,
      height: 500,
    });
    return new Promise((resolve, reject) => {
      const onWindowRemoved = (windowId: number) => {
        if (windowId === win.id) {
          dialogs.delete(message.id);
          reject('Dialog closed');
          browser.windows.onRemoved.removeListener(onWindowRemoved);
        }
      };
      browser.windows.onRemoved.addListener(onWindowRemoved);
      const closeWindowWrapper = (cb) => ((...args) => {
        browser.windows.onRemoved.removeListener(onWindowRemoved);
        browser.windows.remove(win.id);
        cb(...args);
      });
      dialogs.set(message.id, {
        resolve: closeWindowWrapper(resolve),
        reject: closeWindowWrapper(reject)
      });
    });
  },
  onMessage({ dialogId, result, error }: DialogResponse) {
    if (error) {
      dialogs.get(dialogId).reject(error);
    } else {
      dialogs.get(dialogId).resolve(result);
    }
    dialogs.delete(dialogId);
    return Promise.resolve();
  }
}