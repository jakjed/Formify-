import { qboBaseUrl } from './qbo-client';

describe('qbo client helpers', () => {
  it('defaults to sandbox', () => {
    expect(qboBaseUrl()).toBe('https://sandbox-quickbooks.api.intuit.com');
  });

  it('uses production host', () => {
    expect(qboBaseUrl('production')).toBe('https://quickbooks.api.intuit.com');
  });

  it('respects override', () => {
    expect(qboBaseUrl('sandbox', 'http://127.0.0.1:9999/')).toBe(
      'http://127.0.0.1:9999',
    );
  });
});
