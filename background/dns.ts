import * as parseUrl from 'parse-dat-url';
import * as datDnsFactory from 'dat-dns';
import DatDb from './db';
import { DNSLookupFailed } from './errors';

const datUrlMatcher = /^[0-9a-f]{64}$/;
const proxyUrl = 'https://dat-dns.now.sh';

export default class DatDNS {

  db: DatDb
  datDns: any

  constructor(db) {
    this.db = db;
    this.datDns = datDnsFactory({
      persistentCache: this,
      dnsHost: 'cloudflare-dns.com',
      dnsPath: '/dns-query',
      cacheCleanSeconds: 300,
    });
  }

  async resolve(url: string): Promise<string> {
    const { host } = parseUrl(url);
    if (datUrlMatcher.test(host)) {
      return host;
    }
    if (!host) {
      throw new DNSLookupFailed('Could not parse URL');
    }

    // check via Dat-DNS
    try {
      const addr = await this.datDns.resolveName(host);
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
        this.write(host, addr, iTtl);
        console.log(`[dns] Resolved ${host} to ${addr} (dnsserver)`);
        return addr;
      } else {
        throw new DNSLookupFailed(host);
      }
    } catch (e) {
      throw new DNSLookupFailed(host);
    }
  }

  write(host: string, address: string, ttl: number) {
    return this.db.dnsCache.put({
      host,
      address,
      expires: Date.now() + (ttl * 1000),
    });
  }

  async read(host: string, err: any) {
    const res = await this.db.dnsCache.get(host);
    if (res) {
      return res.address;
    }
    throw err;
  }
}
