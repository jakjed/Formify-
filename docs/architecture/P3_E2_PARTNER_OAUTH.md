# P3-E2 — Partner OAuth apps

## Scope

Tenant-scoped OAuth2 **client credentials** apps for partners/machines, with the same scope vocabulary as API keys.

- Admin create/list/revoke OAuth clients (secret shown once)
- Public `POST /api/oauth/token` (`grant_type=client_credentials`)
- Short-lived opaque access tokens (`aptoauth_…`, 1h TTL)
- `AuthGuard` resolves tokens → `authKind: oauth_client` + scopes (`@RequireScopes`)

**Out of scope:** authorization-code / PKCE for end users, refresh tokens, connector ERP OAuth (P3-E4), SCIM (P3-E3).

## APIs

| Method | Path | Auth |
|---|---|---|
| GET | `/api/oauth/scopes` | Admin session |
| GET | `/api/oauth/clients` | Admin session |
| POST | `/api/oauth/clients` | Admin session → `{ clientId, clientSecret }` once |
| POST | `/api/oauth/clients/:id/revoke` | Admin session (deletes outstanding tokens) |
| POST | `/api/oauth/token` | Public; body: `grant_type`, `client_id`, `client_secret` |

## Token response

```json
{
  "access_token": "aptoauth_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "invoices:read exports:read"
}
```

## Admin UI

**Admin → OAuth apps** — create with scopes, copy secret once, revoke.

## Next

P3-E3 SCIM ✅ · P3-E4 Connector runtime · P3-E5 Advanced SoD
