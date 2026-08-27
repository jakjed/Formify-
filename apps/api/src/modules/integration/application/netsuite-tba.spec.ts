import {
  buildNetsuiteRestUrl,
  buildTbaAuthorizationHeader,
  netsuiteHostAccountId,
  oauthEncode,
} from './netsuite-tba';

describe('netsuite TBA', () => {
  it('normalizes account id for host', () => {
    expect(netsuiteHostAccountId('TSTDRV_123')).toBe('tstdrv-123');
  });

  it('builds default SuiteTalk URL', () => {
    expect(
      buildNetsuiteRestUrl('TSTDRV123', '/services/rest/record/v1/vendorBill'),
    ).toBe(
      'https://tstdrv123.suitetalk.api.netsuite.com/services/rest/record/v1/vendorBill',
    );
  });

  it('respects baseUrl override', () => {
    expect(
      buildNetsuiteRestUrl(
        'X',
        '/services/rest/record/v1/vendorBill',
        'http://127.0.0.1:9999',
      ),
    ).toBe('http://127.0.0.1:9999/services/rest/record/v1/vendorBill');
  });

  it('builds OAuth Authorization header with HMAC-SHA256', () => {
    const header = buildTbaAuthorizationHeader(
      'POST',
      'http://127.0.0.1:9999/services/rest/record/v1/vendorBill',
      {
        accountId: 'TSTDRV123',
        consumerKey: 'ck',
        consumerSecret: 'cs',
        tokenId: 'ti',
        tokenSecret: 'ts',
      },
    );
    expect(header.startsWith('OAuth ')).toBe(true);
    expect(header).toContain('oauth_signature_method="HMAC-SHA256"');
    expect(header).toContain('realm="TSTDRV123"');
    expect(header).toContain(`oauth_signature="`);
    expect(oauthEncode('a b')).toBe('a%20b');
  });
});
