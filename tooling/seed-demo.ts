/**
 * Seed demo data for local dev (modules, users, master data, procure samples).
 * Usage: pnpm seed:demo
 * Env: API_BASE (default http://127.0.0.1:3001), TENANT_ID, ADMIN_EMAIL, ADMIN_PASSWORD
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001';
const TENANT_ID =
  process.env.TENANT_ID ?? '686c8950-4c24-4a8b-961e-b69c18e97c32';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@acme.test';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'password1';

async function json<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as T;
  return { status: res.status, body };
}

async function main() {
  const login = await json<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      tenantId: TENANT_ID,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  if (login.status >= 300) {
    throw new Error(`Login failed (${login.status}): ${JSON.stringify(login.body)}`);
  }
  const token = login.body.token;
  console.log('Logged in as', ADMIN_EMAIL);

  for (const key of ['contracts', 'purchase_requests', 'purchase_orders'] as const) {
    const mod = await json(`/api/modules/${key}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ enabled: true }),
    });
    console.log(`Module ${key}:`, mod.status < 300 ? 'enabled' : mod.body);
  }

  const entities = await json<Array<{ id: string; code: string }>>('/api/entities', {
    token,
  });
  const entityId = entities.body[0]?.id;
  if (!entityId) throw new Error('No entity found');

  for (const [path, csv] of [
    ['/api/integration/imports/vendors', 'code,name,email\nACME,Acme Supplies GmbH,ap@acme.test\n'],
    ['/api/integration/imports/gl-accounts', 'code,name\n6000,Office expense\n'],
  ] as const) {
    const form = new FormData();
    form.append('file', new Blob([csv], { type: 'text/csv' }), 'import.csv');
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    console.log(path, res.status < 300 ? 'ok' : await res.text());
  }

  const vendors = await json<Array<{ id: string; name: string }>>('/api/vendors', { token });
  const vendorId = vendors.body[0]?.id;

  const clerkEmail = 'clerk@acme.test';
  const existingUsers = await json<Array<{ email: string }>>('/api/users', { token });
  if (!existingUsers.body.some((u) => u.email === clerkEmail)) {
    await json('/api/users', {
      method: 'POST',
      token,
      body: JSON.stringify({
        email: clerkEmail,
        displayName: 'AP Clerk',
        role: 'ap_clerk',
        password: 'password1',
        entityIds: [entityId],
      }),
    });
    console.log('Created user', clerkEmail);
  }

  const contract = await json<{ id: string }>('/api/contracts', {
    method: 'POST',
    token,
    body: JSON.stringify({
      number: 'CTR-2026-001',
      title: 'Office supplies framework agreement',
      vendorId,
      entityId,
      currency: 'EUR',
      valueMinor: 5000000,
      agreementType: 'framework',
    }),
  });
  console.log('Contract:', contract.status < 300 ? contract.body.id : contract.body);

  const pr = await json<{ id: string }>('/api/purchase-requests', {
    method: 'POST',
    token,
    body: JSON.stringify({
      number: 'PR-2026-001',
      title: 'Q1 office supplies',
      entityId,
      vendorId,
      currency: 'EUR',
      totalMinor: 75000,
      lines: [{ description: 'Paper & toner', quantity: 1, amountMinor: 75000 }],
    }),
  });
  console.log('Purchase request:', pr.status < 300 ? pr.body.id : pr.body);

  const po = await json<{ id: string }>('/api/purchase-orders', {
    method: 'POST',
    token,
    body: JSON.stringify({
      number: 'PO-2026-001',
      title: 'Office supplies order',
      entityId,
      vendorId,
      purchaseRequestId: pr.status < 300 ? pr.body.id : undefined,
      currency: 'EUR',
      totalMinor: 75000,
      lines: [{ description: 'Paper & toner', quantity: 1, amountMinor: 75000 }],
    }),
  });
  console.log('Purchase order:', po.status < 300 ? po.body.id : po.body);

  const upload = new FormData();
  upload.append(
    'file',
    new Blob(
      ['INVOICE\nVendor: Acme Supplies GmbH\nInvoice #: INV-2026-001\nTotal: 750.00 EUR\n'],
      { type: 'text/plain' },
    ),
    'sample-invoice.txt',
  );
  const uploadRes = await fetch(`${API}/api/capture/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: upload,
  });
  console.log('Invoice upload:', uploadRes.status < 300 ? 'ok' : await uploadRes.text());

  console.log('\nDemo seed complete. Refresh the app — nav should show Contracts, Requisitions, Orders.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
