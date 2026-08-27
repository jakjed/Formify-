export type QboCredentials = {
  realmId: string;
  accessToken: string;
  environment?: 'sandbox' | 'production';
  baseUrl?: string;
};

export type QboBillInput = {
  docNumber: string;
  txnDate: string;
  privateNote: string;
  totalMajor: number;
  currency: string;
  vendorId?: string | null;
  vendorName?: string | null;
  expenseAccountId: string;
};

export type QboResult = {
  ok: boolean;
  status: number;
  qboId?: string;
  body: string;
};

export function qboBaseUrl(
  environment: 'sandbox' | 'production' = 'sandbox',
  baseUrlOverride?: string,
): string {
  if (baseUrlOverride) return baseUrlOverride.replace(/\/$/, '');
  return environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

export class QuickbooksClient {
  constructor(private readonly creds: QboCredentials) {}

  async createBill(input: QboBillInput): Promise<QboResult> {
    const base = qboBaseUrl(this.creds.environment, this.creds.baseUrl);
    const url = `${base}/v3/company/${encodeURIComponent(this.creds.realmId)}/bill`;

    const vendorRef = input.vendorId
      ? { value: input.vendorId, name: input.vendorName ?? undefined }
      : input.vendorName
        ? { name: input.vendorName, value: '0' }
        : { value: '1' };

    const payload = {
      DocNumber: input.docNumber.slice(0, 21),
      TxnDate: input.txnDate,
      PrivateNote: input.privateNote.slice(0, 4000),
      CurrencyRef: { value: input.currency },
      VendorRef: vendorRef,
      Line: [
        {
          Amount: input.totalMajor,
          DetailType: 'AccountBasedExpenseLineDetail',
          AccountBasedExpenseLineDetail: {
            AccountRef: { value: input.expenseAccountId },
          },
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.creds.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    const body = await res.text();
    let qboId: string | undefined;
    try {
      const parsed = JSON.parse(body) as {
        Bill?: { Id?: string };
        Id?: string;
      };
      qboId = parsed.Bill?.Id ?? parsed.Id;
    } catch {
      // non-JSON is fine
    }

    return {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      qboId,
      body: body.slice(0, 4000),
    };
  }
}
