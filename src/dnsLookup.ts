import * as Bluebird from 'bluebird';
import * as dns from 'dns';

const dnsResolve = Bluebird.promisify<
  { address: string; ttl: number }[],
  string,
  object
>(dns.resolve4, {
  context: dns
});

let dnsCache = {};

export async function getIPForHost(hostname: string): Promise<string[]> {
  const cachedEntry = dnsCache[hostname];
  if (cachedEntry && cachedEntry.expires > Date.now()) {
    return cachedEntry.result;
  }

  const result = await dnsResolve(hostname, { ttl: true });
  const addresses = result.map((entry) => entry.address);
  if (result && result.length)
    dnsCache[hostname] = {
      result: addresses,
      expires: Date.now() + result[0].ttl * 1000
    };
  return addresses;
}

export function clearDnsCache() {
  dnsCache = {};
}
