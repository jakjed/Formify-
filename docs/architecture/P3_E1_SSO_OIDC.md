# P3-E1 — SSO OIDC

## Scope

First SSO provider via existing `AuthProviderConfig` (`type: oidc`).

- Admin enable/configure OIDC (live or **mock** for local/dev)
- Authorization Code + PKCE + discovery (`jose` for id_token verify in live mode)
- Login SSO button; callback mints existing Aptora session
- Users must already exist (invite/create) — no auto-provision (SCIM = P3-E3)

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/providers?tenantId=` | Public; secrets redacted |
| GET | `/api/auth/providers/admin` | Admin |
| PATCH | `/api/auth/providers/oidc` | Admin upsert settings |
| GET | `/api/auth/oidc/start?tenantId=` | Begin flow (redirect) |
| GET | `/api/auth/oidc/callback` | Code exchange → redirect web `/auth/callback` |

Redirect URI: `{API_PUBLIC_URL}/api/auth/oidc/callback`

## Mock mode

`settings.mode = "mock"` + `mockEmail` (or `email` query on start) skips IdP and issues a session for that existing user.

## Next

P3-E2 Partner OAuth · P3-E3 SCIM · P3-E4 Connector runtime
