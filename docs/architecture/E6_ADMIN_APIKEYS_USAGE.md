# E6 — Admin users, entities, API keys, usage

## Scope

- Admin **users** CRUD (create + role/password update)
- **Entities** list/create/update for the current tenant
- **API keys** (`pl_…`; legacy `aptora_…` still accepted) hashed at rest; scopes: `invoices:read|write`, `masterdata:write`, `exports:read`
- Bearer auth accepts session **or** API key; `@RequireScopes` enforced for keys only
- **Usage & plan**: MTD approved count, soft warn, optional hard block on approve
- Admin UI tabs: Users, Entities, API keys, Usage, Mailbox, Notifications, Audit

## API

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/users` | Admin session |
| PATCH | `/api/users/:id` | Admin session |
| GET/POST | `/api/entities` | Admin session |
| PATCH | `/api/entities/:id` | Admin session |
| GET/POST | `/api/api-keys` | Create returns plaintext `token` once |
| POST | `/api/api-keys/:id/revoke` | |
| GET | `/api/api-keys/scopes` | |
| GET/PATCH | `/api/plan` | Soft/hard MTD limits |
| GET | `/api/usage/summary` | Includes plan + softWarned/hardBlocked |

## API key demo

```bash
# create key in Admin UI, then:
curl -H "Authorization: Bearer pl_…" http://localhost:3001/api/invoices
```
