import { createHmac, randomBytes } from 'node:crypto';

export type NetsuiteTbaCredentials = {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
};

/** RFC 3986 encode for OAuth 1.0. */
export function oauthEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) =>
    `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function netsuiteHostAccountId(accountId: string): string {
  return accountId.trim().toLowerCase().replace(/_/g, '-');
}

export function buildNetsuiteRestUrl(
  accountId: string,
  path: string,
  baseUrlOverride?: string,
): string {
  if (baseUrlOverride) {
    return `${baseUrlOverride.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  }
  const host = netsuiteHostAccountId(accountId);
  return `https://${host}.suitetalk.api.netsuite.com${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * OAuth 1.0 Authorization header for NetSuite TBA (HMAC-SHA256).
 */
export function buildTbaAuthorizationHeader(
  method: string,
  url: string,
  creds: NetsuiteTbaCredentials,
): string {
  const nonce = randomBytes(16).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: timestamp,
    oauth_token: creds.tokenId,
    oauth_version: '1.0',
  };

  const urlObj = new URL(url);
  const baseUri = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  const queryParams: Record<string, string> = {};
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const allParams = { ...queryParams, ...oauthParams };
  const normalized = Object.keys(allParams)
    .sort()
    .map((key) => `${oauthEncode(key)}=${oauthEncode(allParams[key]!)}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    oauthEncode(baseUri),
    oauthEncode(normalized),
  ].join('&');

  const signingKey = `${oauthEncode(creds.consumerSecret)}&${oauthEncode(creds.tokenSecret)}`;
  const signature = createHmac('sha256', signingKey)
    .update(baseString)
    .digest('base64');

  const realm = creds.accountId.toUpperCase().replace(/-/g, '_');
  const headerParams = {
    realm,
    ...oauthParams,
    oauth_signature: signature,
  };

  const header = Object.entries(headerParams)
    .map(([key, value]) =>
      key === 'realm'
        ? `realm="${value}"`
        : `${key}="${oauthEncode(value)}"`,
    )
    .join(', ');

  return `OAuth ${header}`;
}
