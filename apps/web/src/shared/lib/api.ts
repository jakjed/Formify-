const TOKEN_KEY = 'aptora_token';
const TENANT_KEY = 'aptora_tenant_id';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, tenantId: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TENANT_KEY, tenantId);
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TENANT_KEY);
}

export function getStoredTenantId(): string | null {
  return sessionStorage.getItem(TENANT_KEY);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
