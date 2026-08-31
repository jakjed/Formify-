import { test, expect } from '@playwright/test';

const API = process.env.API_BASE ?? 'http://127.0.0.1:3001';

test.describe('Phase 1 web + API acceptance', () => {
  test('login and bootstrap pages render', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading')).toContainText(/Procure Ledger/i);
    await page.getByRole('link', { name: /Create one/i }).click();
    await expect(page).toHaveURL(/bootstrap/);
    await expect(page.getByText(/Create a workspace/i)).toBeVisible();
  });

  test('J1-lite: bootstrap workspace in UI', async ({ page }) => {
    const slug = `ui-${Date.now().toString(36)}`;
    await page.goto('/bootstrap');
    await page.getByLabel('Company name').fill(`UI ${slug}`);
    await page.getByLabel('Workspace slug').fill(slug);
    await page.getByLabel('Admin email').fill(`admin@${slug}.test`);
    await page.getByLabel('Display name').fill('Admin');
    await page.getByLabel('Password').fill('password1');
    await page.getByRole('button', { name: /Create workspace/i }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });

  test('permission deny for clerk listing users', async ({ request }) => {
    const slug = `deny-${Date.now().toString(36)}`;
    const tenant = await request.post(`${API}/api/tenants`, {
      data: { name: `Deny ${slug}`, slug, region: 'us' },
    });
    expect(tenant.ok()).toBeTruthy();
    const { id: tenantId } = (await tenant.json()) as { id: string };

    await request.post(`${API}/api/auth/register`, {
      data: {
        tenantId,
        email: `admin@${slug}.test`,
        displayName: 'Admin',
        password: 'password1',
      },
    });
    const adminLogin = await request.post(`${API}/api/auth/login`, {
      data: {
        tenantId,
        email: `admin@${slug}.test`,
        password: 'password1',
      },
    });
    const { token: adminToken } = (await adminLogin.json()) as { token: string };

    const invite = await request.post(`${API}/api/users/invite`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        email: `clerk@${slug}.test`,
        displayName: 'Clerk',
        role: 'ap_clerk',
      },
    });
    const { inviteToken } = (await invite.json()) as { inviteToken: string };
    const accept = await request.post(`${API}/api/auth/invite/accept`, {
      data: { token: inviteToken, password: 'clerkpass1' },
    });
    const { token: clerkToken } = (await accept.json()) as { token: string };

    const denied = await request.get(`${API}/api/users`, {
      headers: { Authorization: `Bearer ${clerkToken}` },
    });
    expect(denied.status()).toBe(403);
  });
});
