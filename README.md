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

## Install in Firefox

You will need [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) or [Nightly](https://www.mozilla.org/en-US/firefox/channel/desktop/). Other Firefox releases do not allow unsigned extensions to be installed.

 1. Go to `about:config` and set the pref `xpinstall.signatures.required` to `false` and `extensions.experiments.enabled` to `true`.
 2. Download the [latest version](https://github.com/cliqz-oss/dat-webext/releases/download/v0.2.1/dat_protocol-0.2.1.zip) of the extension.
 3. Go to `about:addons` and choose 'Install addon from file' from the cog menu in the top right, then browse to zip file you just downloaded. The browser will ask for permissions to install.

## License

MIT.
