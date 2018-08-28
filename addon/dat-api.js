console.log('hello dat api');

window.addEventListener('message', ({ data }) => {
  if (data.source === 'DATBG') {
    console.log('got mesage', data);
  }
});

window.DatArchive = {
  test: () => window.postMessage({ action: 'ping', source: 'DATAPI' }, '*'),
};