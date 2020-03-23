# Changelog

## [0.1.5] - 2020-03-03

 * Add dark mode settings styling.

## [0.1.4] - 2020-01-23

 * Fixes to settings page

## [0.1.3] - 2020-01-21

 * Updated dependencies

## [0.1.2] - 2020-01-09

 * Settings page matches browser style.
 * Add German localisation for settings.

## [0.1.1] - 2019-12-23

 * Add a settings page
 * Remove page action
 * Compatability mode for when indexeddb is disabled/broken.

## [0.1.0] - 2019-12-19

 * Use a single indexedDB for all dats. This improves initial load times and declutters
 the storage space.
 * Added a performance probe to measure connectivity across different network environments.
 * Make swarm settings configurable, and default to no-announce and no upload.

## [0.0.16] - 2019-12-09

 * Large refactor to move most dat logic to [sams-dat-api](https://github.com/sammacbeth/sams-dat-api).

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

[0.1.5]: https://github.com/cliqz-oss/dat-webext/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/cliqz-oss/dat-webext/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/cliqz-oss/dat-webext/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/cliqz-oss/dat-webext/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/cliqz-oss/dat-webext/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.16...v0.1.0
[0.0.16]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.15...v0.0.16
[0.0.15]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.14...v0.0.15
[0.0.14]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.13...v0.0.14
[0.0.13]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.12...v0.0.13
[0.0.12]: https://github.com/cliqz-oss/dat-webext/compare/v0.0.11...v0.0.12
[0.0.11]: https://github.com/cliqz-oss/dat-webext/releases/tag/v0.0.11
