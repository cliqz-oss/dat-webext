#!/bin/bash
mkdir -p addon/libdweb
cp -r node_modules/@sammacbeth/libdweb/src/* addon/libdweb/

mkdir -p addon/assets
cp node_modules/bulma/css/* addon/assets/

# Patch dependencies
# Remove 'browser' attribute in hyperswarm so we can compile a webext compatibile version.
mv ./node_modules/hyperdiscovery/package.json ./node_modules/hyperdiscovery/package.web.json && \
    node -e "var p = require(\"./node_modules/hyperdiscovery/package.web.json\"); delete p.browser; console.log(JSON.stringify(p, null, \"  \"));" > ./node_modules/hyperdiscovery/package.json
# Fix bug with nextTick in hypercore
sed -i.bak "s/require('process-nextick-args')/process.nextTick/g" ./node_modules/hypercore/index.js && rm ./node_modules/hypercore/index.js.bak
# Replace utp-native with utp-wasm in discovery-swarm
sed -i.bak "s/require('utp-native')/require('\@sammacbeth\/utp-wasm')/g" ./node_modules/discovery-swarm/index.js && rm ./node_modules/discovery-swarm/index.js.bak
# Require path.posix in hyperdrive
sed -i.bak "s/require('path').posix/require('path')/g" ./node_modules/hyperdrive/index.js && rm ./node_modules/hyperdrive/index.js.bak
