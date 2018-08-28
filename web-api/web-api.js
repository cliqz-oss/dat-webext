const events = require('events');
const Spanan = require('spanan').default;
const createDatArchiveApi = require('./dat-archive-rpc');
const { MSG_SOURCE_PAGE, MSG_SOURCE_CS } = require('./constants');

const wrapper = new Spanan((_message) => {
  const message = _message;
  message.source = MSG_SOURCE_PAGE;
  window.postMessage(message, '*');
});
// the eventBus is a multiplexer for incoming events from background
const eventBus = new events.EventEmitter();
wrapper.export({
  pushEvent(event) {
    eventBus.emit('event', event);
  }
});
const proxy = wrapper.createProxy();

window.addEventListener('message', (event) => {
  if (event.data &&
    event.data.source === MSG_SOURCE_CS) {
    wrapper.handleMessage(event.data);
  }
});

window.DatArchive = createDatArchiveApi(proxy, eventBus);
