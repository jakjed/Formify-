import {
  buildNetsuiteRestUrl,
  buildTbaAuthorizationHeader,
  type NetsuiteTbaCredentials,
} from './netsuite-tba';

export type VendorBillInput = {
  externalId: string;
  tranDate: string;
  memo: string;
  currency: string;
  totalMajor: number;
  vendorExternalId?: string | null;
  vendorName?: string | null;
};

export type SuiteTalkResult = {
  ok: boolean;
  status: number;
  externalId: string;
  netsuiteId?: string;
  location?: string | null;
  body: string;
};

export class NetsuiteSuiteTalkClient {
  constructor(
    private readonly creds: NetsuiteTbaCredentials,
    private readonly baseUrlOverride?: string,
  ) {}

  async createVendorBill(input: VendorBillInput): Promise<SuiteTalkResult> {
    const path = '/services/rest/record/v1/vendorBill';
    const url = buildNetsuiteRestUrl(
      this.creds.accountId,
      path,
      this.baseUrlOverride,
    );

    const payload: Record<string, unknown> = {
      externalId: input.externalId,
      tranDate: input.tranDate,
      memo: input.memo,
      currency: { refName: input.currency },
      // Account-based expense line — NetSuite may require a valid account id in live tenants.
      expense: {
        items: [
          {
            amount: input.totalMajor,
            memo: input.memo,
          },
        ],
      },
    };

    if (input.vendorExternalId) {
      payload.entity = { externalId: input.vendorExternalId };
    } else if (input.vendorName) {
      payload.entity = { refName: input.vendorName };
    }

    const authorization = buildTbaAuthorizationHeader('POST', url, this.creds);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'transient',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    const body = await res.text();
    let netsuiteId: string | undefined;
    try {
      const parsed = JSON.parse(body) as { id?: string | number };
      if (parsed.id != null) netsuiteId = String(parsed.id);
    } catch {
      // non-JSON error body from NetSuite is fine
    }

    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      externalId: input.externalId,
      netsuiteId,
      location: res.headers.get('location'),
      body: body.slice(0, 4000),
    };
  }
}
