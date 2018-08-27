# Dat-webext

This is a Webextension which enables websites to be loaded over the `dat://` protocol on Firefox. 
It uses the [libdweb](https://github.com/mozilla/libdweb) protocol handler to register the `dat://` protocol, 
and [dat-archive-web](https://github.com/RangerMauve/dat-archive-web) to replicate with the Dat network 
via a [dat-gateway](https://github.com/RangerMauve/dat-gateway) instance.

## Try it out

Install dependencies and build:
```
npm install
npm run build
```

Run with [web-ext](https://github.com/mozilla/web-ext) (requires [Firefox Developer Edition](https://www.mozilla.org/en-US/firefox/developer/) installed):
```
npm run start
```

or, run in an existing firefox profile:
 * Disable the content sandbox (required for experimental APIs): In `about:config`, set the `security.sandbox.content.level` pref to `2`.
 * Go to `about:debugging`
 * Select 'Load Temporary Add-on', and select `addon/manifest.json` from this repository.

## License

MIT.
