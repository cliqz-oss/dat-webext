# Changelog

## [0.0.15] - 2019-10-04

 * We now use [discovery-swarm-webrtc](https://github.com/geut/discovery-swarm-webrtc) in tandem with standard DAT discovery in order to improve peer connectivity.

## [0.0.14] - 2019-09-12
 
 * Added UTP support using utp-wasm (#60).
 * Added tests for Firefox 71 (#56).
 * Changed library and DNS to use a Dexie database backend (#57).

## [0.0.13] - 2019-09-02

 * Fixed an issue where not all data was including when forking an archive.
 * Fixed exception when getting archive stats for Dats which did not yet load their data feed.

## [0.0.12] - 2019-09-02

 * Added automatic disabling of user prompts on platforms with no `browser.window` API (i.e. Geckoview).
 * Fixed the cancel button in the fork dialog.
 * Update libdweb dependency: UDPSocket in parent process

## [0.0.11] - 2019-08-21

 * Update libdweb dependency: TCPSocket in parent process
 * Bump various dependencies.

[0.0.15]:https://github.com/cliqz-oss/dat-webext/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/cliqz-oss/dat-webext/releases/tag/v0.0.11
