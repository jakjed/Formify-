# E9 — Invoice comments & activity

## Scope

- `InvoiceComment` model — per-invoice threaded notes
- `GET/POST /api/invoices/:id/comments`
- `GET /api/invoices/:id/activity` — merged audit trail + comments (newest first)
- Audit on save, void, resolve exceptions; workflow events already audited
- Invoice workspace: Activity timeline + comment form

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/invoices/:id/comments` | Chronological |
| POST | `/api/invoices/:id/comments` | `{ body }` |
| GET | `/api/invoices/:id/activity` | Audit + comments merged |

Activity audit actions include `invoice.updated`, `invoice.uploaded`, `invoice.submitted`, `invoice.approved`, `invoice.rejected`, `invoice.voided`, `invoice.exceptions_resolved`.
