# P3-E3 — SCIM user provisioning

## Scope

Minimal **SCIM 2.0 Users** API for IdP provisioning (Entra / Okta style).

- Machine auth only: API key (`aptora_`) or OAuth access token (`aptoauth_`)
- Scopes: `scim:read`, `scim:write` (same vocabulary as Admin → API keys / OAuth apps)
- Maps to existing `User` rows (no Groups, no new Prisma models)

**Out of scope:** Groups, hard delete, dedicated SCIM bearer table, auto-provision on SSO login.

## Attribute map

| SCIM | Aptora |
|---|---|
| `id` | `User.id` |
| `userName` / `emails[0].value` | `email` |
| `displayName` | `displayName` |
| `active` | `status !== locked` (`false` → `locked`) |
| `roles[0].value` | `role` (`admin` / `ap_manager` / `ap_clerk` / `approver`) |

Create sets `status: active` with **null password** (SSO-ready). Default role: `ap_clerk`.

DELETE soft-deactivates (`status: locked`).

## APIs

| Method | Path | Scope |
|---|---|---|
| GET | `/api/scim/v2/Users` | `scim:read` — supports `filter=userName eq "a@b.com"` |
| GET | `/api/scim/v2/Users/:id` | `scim:read` |
| POST | `/api/scim/v2/Users` | `scim:write` |
| PATCH | `/api/scim/v2/Users/:id` | `scim:write` — `replace`/`add` ops |
| DELETE | `/api/scim/v2/Users/:id` | `scim:write` → deactivate |

Content-Type responses: `application/scim+json`.

## Setup

1. Admin → OAuth apps (or API keys) → create with `scim:read` + `scim:write`
2. For OAuth: `POST /api/oauth/token` → Bearer `aptoauth_…`
3. Point IdP SCIM base URL to `{API}/api/scim/v2`

## Next

P3-E4 Connector runtime · P3-E5 Advanced SoD
