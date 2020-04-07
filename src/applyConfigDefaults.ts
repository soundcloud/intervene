import * as url from 'url';
import * as Joi from '@hapi/joi';
import { RouteOptionsCors } from '@hapi/hapi';
import { ProxyConfig } from './ProxyConfig';

const configDefaults: Partial<ProxyConfig> = {
  skipEtcHosts: true,
  writeEtcHosts: true,
  createPrivilegedPortProxy: true,
  allowUntrustedCerts: true,
  removeStrictTransportSecurity: true
};

export interface ProxyConfigWithDefaults extends ProxyConfig {
  targetParsedUrl: url.UrlWithStringQuery;
  localParsedUrl: url.UrlWithStringQuery;
  cors: boolean | RouteOptionsCors;
}

export function applyConfigDefaults(
  proxyConfigImport: ProxyConfig,
  configFilePath: string
): ProxyConfigWithDefaults {
  const proxyConfig: ProxyConfig = { ...configDefaults, ...proxyConfigImport };

  // Lowercase all the targetHeaders
  const targetHeaders = proxyConfig.targetHeaders || {};
  const lowerCaseTargetHeaders = Object.keys(targetHeaders).reduce(
    (headers, k) => {
      headers[k.toLowerCase()] = targetHeaders[k];
      return headers;
    },
    {}
  );
  const proxyConfigWithDefaults = {
    ...proxyConfig,
    targetHeaders: lowerCaseTargetHeaders,
    targetParsedUrl: url.parse(proxyConfig.target),
    localUrl: proxyConfig.localUrl || proxyConfig.target,
    localParsedUrl: url.parse(proxyConfig.localUrl || proxyConfig.target),
    cors:
      proxyConfig.cors !== undefined
        ? proxyConfig.cors
        : { credentials: true, maxAge: 60 }
  };
  let hostname = proxyConfigWithDefaults.localParsedUrl.hostname;

  if (hostname && hostname === 'localhost') {
    proxyConfigWithDefaults.writeEtcHosts = false;
  }

  return proxyConfigWithDefaults;
}
