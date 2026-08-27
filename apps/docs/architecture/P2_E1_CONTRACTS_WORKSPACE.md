# P2-E1 — Contracts workspace

## Scope

Usable contract detail workspace after P2-E0 CRUD:

- Vendor / entity FK relations + `ContractComment`
- `PATCH` (draft / in_approval), `POST :id/amend`, `POST :id/renew`
- Comments + activity timeline (E9 pattern)
- Web `/contracts/:id` workspace with status actions

## APIs

| Method | Path | Notes |
|---|---|---|
| PATCH | `/api/contracts/:id` | Draft / in_approval only |
| POST | `/api/contracts/:id/amend` | Active only — title, value, dates, notes |
| POST | `/api/contracts/:id/renew` | Active only — `{ endDate }` after current |
| GET/POST | `/api/contracts/:id/comments` | |
| GET | `/api/contracts/:id/activity` | Audit + comments |

## Next

P2-E2 PR→PO convert · P2-E3 receiving · P2-E4 invoice match
