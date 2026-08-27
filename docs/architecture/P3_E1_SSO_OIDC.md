# P3-E1 — SSO (OIDC + SAML 2.0)

## Scope

Enterprise sign-in via existing `AuthProviderConfig`:

- **OIDC** — Authorization Code + PKCE (`oidc` type)
- **SAML 2.0** — SP-initiated flow (`saml` type); mock mode for local/dev

Users must already exist (invite/create) — no auto-provision (SCIM = P3-E3).

## OIDC APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/providers?tenantId=` | Public; secrets redacted |
| GET | `/api/auth/providers/admin` | Admin |
| PATCH | `/api/auth/providers/oidc` | Admin upsert settings |
| GET | `/api/auth/oidc/start?tenantId=` | Begin flow (redirect) |
| GET | `/api/auth/oidc/callback` | Code exchange → redirect web `/auth/callback` |

Redirect URI: `{API_PUBLIC_URL}/api/auth/oidc/callback`

## SAML 2.0 APIs

| Method | Path | Notes |
|---|---|---|
| PATCH | `/api/auth/providers/saml` | Admin — IdP entity ID, SSO URL, cert, mock/live |
| GET | `/api/auth/saml/metadata?tenantId=` | SP metadata XML for IdP configuration |
| GET | `/api/auth/saml/start?tenantId=` | SP-initiated login (redirect) |
| GET/POST | `/api/auth/saml/acs` | Assertion Consumer Service |

ACS URL: `{API_PUBLIC_URL}/api/auth/saml/acs`

### Mock mode (SAML)

`settings.mode = "mock"` + `mockEmail` (or `email` query on start) skips IdP and issues a session for that existing user — same contract as OIDC mock.

### Live mode (SAML)

Admin stores IdP metadata (entity ID, SSO URL, X.509 certificate). Full assertion signature validation ships in a follow-up; use OIDC live or SAML mock until then.

## Admin UI

**Admin → SSO** — separate forms for OIDC and SAML 2.0.

## Next

P3-E2 Partner OAuth ✅ · P3-E3 SCIM · SAML live ACS validation
