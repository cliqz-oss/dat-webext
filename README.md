# Dat-webext

This is a Webextension which enables websites to be loaded over the `dat://` protocol on Firefox. 
It uses the [libdweb](https://github.com/mozilla/libdweb) protocol handler to register the `dat://` protocol, 
and polyfills for node's `net` and `dgram` APIs using libdweb's TCPSocket and UDPSocket in order
to bundle the dat network implementation with the extension. More on how this works in this [post](https://sammacbeth.eu/blog/2019/05/12/dat-for-firefox-2.html)

## Try it out

Install dependencies and build:
```
npm install
npm run build
```

Run with [web-ext](https://github.com/mozilla/web-ext) (requires [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) or [Firefox Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/#nightly) installed):
```
npm run start
```

or, run in an existing firefox profile:
 * Disable the content sandbox (required for experimental APIs): In `about:config`, set the `security.sandbox.content.level` pref to `2`.
 * Go to `about:debugging`
 * Select 'Load Temporary Add-on', and select `addon/manifest.json` from this repository.

## License

MIT.
