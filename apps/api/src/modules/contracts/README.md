# Contracts

Phase 2 commercial module — vendor agreements lifecycle (draft → active).

## Workspace (P2-E1)

- `PATCH /api/contracts/:id` — edit while draft / in_approval
- `POST /api/contracts/:id/amend` — amend active (title, value, dates, notes)
- `POST /api/contracts/:id/renew` — extend active end date
- `GET|POST /api/contracts/:id/comments` · `GET /api/contracts/:id/activity`
