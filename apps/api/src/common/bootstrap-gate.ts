/**
 * Public tenant creation is open in local/dev by default and gated in production.
 * Set ALLOW_PUBLIC_BOOTSTRAP=true to force open, or BOOTSTRAP_TOKEN for a shared setup key.
 */
export function isPublicBootstrapAllowed(setupToken?: string | null): boolean {
  const allow = process.env.ALLOW_PUBLIC_BOOTSTRAP?.trim().toLowerCase();
  if (allow === 'true' || allow === '1') return true;
  if (allow === 'false' || allow === '0') {
    return matchesBootstrapToken(setupToken);
  }
  if (process.env.NODE_ENV === 'production') {
    return matchesBootstrapToken(setupToken);
  }
  return true;
}

function matchesBootstrapToken(setupToken?: string | null): boolean {
  const expected = process.env.BOOTSTRAP_TOKEN?.trim();
  if (!expected) return false;
  return Boolean(setupToken && setupToken === expected);
}

export function bootstrapStatus() {
  const allowed = isPublicBootstrapAllowed(null);
  return {
    allowed,
    waitlist: !allowed,
    production: process.env.NODE_ENV === 'production',
  };
}
