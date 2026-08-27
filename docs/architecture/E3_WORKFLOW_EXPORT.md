# E3 — Workflows + Integration export

## Workflows

- Default approval policy per tenant (`autoApproveUnderMinor`, default €100)
- `POST /api/invoices/:id/submit` — auto-approve under threshold, else create approval tasks
- `GET /api/approvals/my-work`
- `POST /api/approvals/:taskId/approve|reject`
- `GET/PATCH /api/workflow/policy`
- Force approve still available for admins via `POST /api/invoices/:id/approve`

## Integration Center

- Template catalog + CSV download
- `POST /api/integration/exports/approved-invoices` → CSV + mark invoices `exported`
- Job history `GET /api/integration/jobs`

## Web

- My Work inbox
- Integration Center page
- Invoice workspace: Submit for approval + Force approve
