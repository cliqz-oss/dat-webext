import * as parseUrl from 'parse-dat-url';
import * as datDnsFactory from 'dat-dns';
import { DNSLookupFailed } from './errors';

const datUrlMatcher = /^[0-9a-f]{64}$/;
const proxyUrl = 'https://dat-dns.now.sh';

interface CacheEntry extends browser.storage.StorageObject {
  host: string
  address: string
  expires: number
}

class DNSCache {
  cache: Map<string, CacheEntry>

  constructor() {
    this.cache = new Map();
  }

  async get(host: string): Promise<CacheEntry> {
    if (this.cache.has(host)) {
      return this.cache.get(host);
    }
    const key = `dns/${host}`
    const results: { [k: string]: CacheEntry } = await browser.storage.local.get(key);
    const stored: CacheEntry = results[key];
    if (stored) {
      this.cache.set(host, stored);
      return stored;
    }
    return null;
  }

  async set(entry: CacheEntry) {
    this.cache.set(entry.host, entry);
    return browser.storage.local.set({ [`dns/${entry.host}`]: entry });
  }

  async delete(host) {
    this.cache.delete(host);
    return browser.storage.local.remove(`dns/${host}`);
  }

  write(host: string, address: string, ttl: number) {
    return this.set({
      host,
      address,
      expires: Date.now() + (ttl * 1000),
    });
  }

  async read(host: string, err: any) {
    const res = await this.get(host);
    if (res) {
      return res.address;
    }
    throw err;
  }
}

const lookupCache = new DNSCache();
const datDns = datDnsFactory({
  persistentCache: lookupCache,
  dnsHost: 'dns.quad9.net:5053',
  dnsPath: '/dns-query',
});

export default async function resolve(url: string): Promise<string> {
  const { host } = parseUrl(url);
  if (datUrlMatcher.test(host)) {
    return host;
  }
  if (!host) {
    throw new DNSLookupFailed('Could not parse URL');
  }
  // check for cached lookup
  const cached = await lookupCache.get(host);
  const cacheExpired = !cached || cached.expires < Date.now()
  if (!cacheExpired) {
    return cached.address;
  }

  // check via Dat-DNS
  try {
    const addr = await datDns.resolveName(host);
    console.log(`[dns] Resolved ${host} to ${addr} (datdns)`);
    return addr;
  } catch (e) {
  }

  // check via fetch - backup for when CORS prevents fetch.
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
      lookupCache.set({ host, address: addr, expires: Date.now() + (iTtl * 1000) });
      console.log(`[dns] Resolved ${host} to ${addr} (dnsserver)`);
      return addr;
    } else {
      throw new DNSLookupFailed(host);
    }
  } catch (e) {
    if (cached) {
      console.log(`[dns] Using expired dns entry from cache: ${host} to ${cached.address}`);
      // use outdated cache entry
      return cached.address;
    }
    throw new DNSLookupFailed(host);
  }
  return null;
}