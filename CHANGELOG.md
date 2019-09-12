# Changelog

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