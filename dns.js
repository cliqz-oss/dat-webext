const parseUrl = require('parse-dat-url');

const datUrlMatcher = /^[0-9a-f]{64}$/;
const lookupCache = new Map();

const proxyUrl = 'https://dat-gateway-niqwyeuxyi.now.sh';

module.exports = async function resolve(url) {
  const { host } = parseUrl(url);
  if (datUrlMatcher.test(host)) {
    return host;
  }
  // check for cached lookup
  const cached = lookupCache.get(host);
  if (cached) {
    if (cached.expires > Date.now()) {
      return cached.address;
    } else {
      lookupCache.delete(host);
    }
  }
  // check via fetch
  try {
    const wellKnownUrl = `${proxyUrl}/${host}/.well-known/dat`
    const response = await fetch(wellKnownUrl, {
      credentials: 'omit'
    });
    const lookup = await response.text();
    let [addr, ttl] = lookup.split('\n');
    if (addr.startsWith('dat://')) {
      addr = addr.substring(6);
      ttl = ttl.startsWith('TTL=') || ttl.startsWith('ttl=') ? parseInt(ttl.substring(4)) : 3600;
      lookupCache.set(host, { address: addr, expires: Date.now() + (ttl * 1000) });
      return addr;
    }
  } catch (e) {
    console.error('lookup error', e);
  }
  return null;
}