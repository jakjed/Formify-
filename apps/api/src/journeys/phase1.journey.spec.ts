/**
 * Phase 1 journey tests (J1–J3 + permission deny) against a running API.
 * Set RUN_JOURNEY=1 and API_BASE (default http://127.0.0.1:3001).
 */
const API = process.env.API_BASE ?? 'http://127.0.0.1:3001';
const run = process.env.RUN_JOURNEY === '1';

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

(run ? describe : describe.skip)('Phase 1 journeys (live API)', () => {
  const slug = `j-${Date.now().toString(36)}`;
  let tenantId = '';
  let adminToken = '';
  let clerkToken = '';
  let invoiceId = '';

  it('J1 — bootstrap tenant, invite clerk, import master data, upload, approve, export, usage', async () => {
    const tenant = await json<{ id: string }>('/api/tenants', {
      method: 'POST',
      body: JSON.stringify({ name: `Journey ${slug}`, slug, region: 'eu' }),
    });
    expect([200, 201]).toContain(tenant.status);
    tenantId = tenant.body.id;

    await json('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        email: `admin@${slug}.test`,
        displayName: 'Admin',
        password: 'password1',
      }),
    });
    const login = await json<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        email: `admin@${slug}.test`,
        password: 'password1',
      }),
    });
    expect([200, 201]).toContain(login.status);
    adminToken = login.body.token;

    const invite = await json<{
      inviteToken: string;
      user: { id: string };
    }>('/api/users/invite', {
      method: 'POST',
      token: adminToken,
      body: JSON.stringify({
        email: `clerk@${slug}.test`,
        displayName: 'Clerk',
        role: 'ap_clerk',
      }),
    });
    expect([200, 201]).toContain(invite.status);

    const accept = await json<{ token: string }>('/api/auth/invite/accept', {
      method: 'POST',
      body: JSON.stringify({
        token: invite.body.inviteToken,
        password: 'clerkpass1',
      }),
    });
    expect([200, 201]).toContain(accept.status);
    clerkToken = accept.body.token;

    const vendorCsv = `code,name,email\nV1,Acme Supplies,ap@acme.test\n`;
    const glCsv = `code,name\n6000,Office expense\n`;
    for (const [path, content] of [
      ['/api/integration/imports/vendors', vendorCsv],
      ['/api/integration/imports/gl-accounts', glCsv],
    ] as const) {
      const form = new FormData();
      form.append(
        'file',
        new Blob([content], { type: 'text/csv' }),
        'import.csv',
      );
      const res = await fetch(`${API}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
        body: form,
      });
      expect(res.status).toBeLessThan(300);
    }

    const uploadBody = new FormData();
    uploadBody.append(
      'file',
      new Blob(
        [
          'INVOICE\nVendor: Acme Supplies\nInvoice #: INV-J1\nTotal: 42.00 EUR\n',
        ],
        { type: 'text/plain' },
      ),
      'sample.txt',
    );
    const uploadRes = await fetch(`${API}/api/capture/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clerkToken}` },
      body: uploadBody,
    });
    expect(uploadRes.status).toBeLessThan(300);
    const uploaded = (await uploadRes.json()) as { id: string };
    invoiceId = uploaded.id;

    // Ensure fields ready for submit
    await json(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      token: clerkToken,
      body: JSON.stringify({
        invoiceNumber: `INV-${slug}`,
        vendorNameRaw: 'Acme Supplies',
        currency: 'EUR',
        subtotalMinor: 4200,
        taxMinor: 0,
        totalMinor: 4200,
      }),
    });

    // Resolve any exceptions then submit
    await json(`/api/invoices/${invoiceId}/resolve-exceptions`, {
      method: 'POST',
      token: clerkToken,
    }).catch(() => undefined);

    const submit = await json(`/api/invoices/${invoiceId}/submit`, {
      method: 'POST',
      token: clerkToken,
    });
    // may auto-approve under threshold
    expect([200, 201]).toContain(submit.status);

    let inv = await json<{ status: string }>(`/api/invoices/${invoiceId}`, {
      token: adminToken,
    });
    if (inv.body.status === 'in_approval') {
      const approve = await json(`/api/invoices/${invoiceId}/approve`, {
        method: 'POST',
        token: adminToken,
      });
      expect([200, 201]).toContain(approve.status);
      inv = await json<{ status: string }>(`/api/invoices/${invoiceId}`, {
        token: adminToken,
      });
    }
    expect(inv.body.status).toBe('approved');

    const exportRes = await fetch(
      `${API}/api/integration/exports/approved-invoices`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );
    expect(exportRes.status).toBeLessThan(300);

    const usage = await json<{ approvedInvoices: number }>(
      '/api/usage/summary',
      { token: adminToken },
    );
    expect(usage.body.approvedInvoices).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('J3 — exception recovery leaves audit trail', async () => {
    expect(invoiceId).toBeTruthy();
    const comment = await json(`/api/invoices/${invoiceId}/comments`, {
      method: 'POST',
      token: clerkToken,
      body: JSON.stringify({ body: 'Fixed coding for journey' }),
    });
    expect([200, 201]).toContain(comment.status);

    const activity = await json<{ kind: string }[]>(
      `/api/invoices/${invoiceId}/activity`,
      { token: clerkToken },
    );
    expect(activity.status).toBe(200);
    expect(activity.body.length).toBeGreaterThan(0);
  });

  it('permission deny — clerk cannot manage users', async () => {
    const denied = await json('/api/users', { token: clerkToken });
    expect(denied.status).toBe(403);
  });

  it('tenant isolation — other tenant token cannot read invoice', async () => {
    const otherSlug = `iso-${Date.now().toString(36)}`;
    const other = await json<{ id: string }>('/api/tenants', {
      method: 'POST',
      body: JSON.stringify({
        name: `Other ${otherSlug}`,
        slug: otherSlug,
        region: 'us',
      }),
    });
    await json('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: other.body.id,
        email: `admin@${otherSlug}.test`,
        displayName: 'Other',
        password: 'password1',
      }),
    });
    const otherLogin = await json<{ token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: other.body.id,
        email: `admin@${otherSlug}.test`,
        password: 'password1',
      }),
    });
    const leaked = await json(`/api/invoices/${invoiceId}`, {
      token: otherLogin.body.token,
    });
    expect([403, 404]).toContain(leaked.status);
  });
});
