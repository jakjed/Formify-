# E12 — Hardening (rate limits, residency, isolation, export)

## Scope (PRD E8 + A-04 + R-02 + P-09)

- Per-tenant / API-key **rate limiting** (`RateLimitGuard`)
- List caps (invoice list/export max 500)
- Worklist **CSV export** `GET /api/invoices/export.csv`
- **Global search** `GET /api/search?q=` for command palette
- Tenant **isolation** Jest test
- **Residency** documentation + region pin on tenants

## Config

| Env | Default | Meaning |
|---|---|---|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window length |
| `RATE_LIMIT_MAX` | `120` | Max requests per principal per window |

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/search?q=` | Invoices + vendors (+ users for admin) |
| GET | `/api/invoices/export.csv` | Same filters as list |

## Docs

- [RESIDENCY.md](./RESIDENCY.md)
