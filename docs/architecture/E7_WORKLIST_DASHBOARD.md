# E7 — Invoice worklist, exceptions, ops dashboard

## Scope

- Rich invoice list filters: `status`, `q`, `exceptionCode`, `hasOpenExceptions`, `sort`, `limit`
- Exception queue: `GET /api/invoices/exceptions` (group counts + aging)
- Ops dashboard: `GET /api/ops/dashboard` (status mix, exception aging, export backlog, usage)
- Web: saved views (builtin + localStorage), Exceptions page, Dashboard page

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/invoices` | Filters above |
| GET | `/api/invoices/exceptions?code=` | Open exceptions, oldest first |
| GET | `/api/ops/dashboard` | Manager KPIs |

## UI

- **Invoices** — view chips, search, sort, age column, Save view
- **Exceptions** — filter by code, resolve action
- **Dashboard** — clickable KPI tiles into worklists
