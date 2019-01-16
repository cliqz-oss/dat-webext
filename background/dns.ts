import * as parseUrl from 'parse-dat-url';
import { DNSLookupFailed } from './errors';

const datUrlMatcher = /^[0-9a-f]{64}$/;
const lookupCache = new Map();

const proxyUrl = 'https://dat-dns.now.sh';

export default async function resolve(url: string): Promise<string> {
  const { host } = parseUrl(url);
  if (datUrlMatcher.test(host)) {
    return host;
  }
  if (!host) {
    throw new DNSLookupFailed('Could not parse URL');
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
      const iTtl = ttl.startsWith('TTL=') || ttl.startsWith('ttl=') ? parseInt(ttl.substring(4)) : 3600;
      lookupCache.set(host, { address: addr, expires: Date.now() + (iTtl * 1000) });
      return addr;
    } else {
      throw new DNSLookupFailed(host);
    }
  } catch (e) {
    throw new DNSLookupFailed(host);
  }
  return null;
}