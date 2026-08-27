# Approval rules (entity / amount bands)

On submit, Aptora evaluates **enabled** `ApprovalRule` rows for the tenant **and module**, highest `priority` first.

`moduleKey` scopes policies and rules to one of:

`invoices` | `contracts` | `purchase_requests` | `purchase_orders` | `accruals`

Defaults exist per module (seeded on first read). Invoice policies use `autoApproveUnderMinor`; procure modules store stage labels in `chainJson`.

A rule matches when:
- `moduleKey` equals the record’s module (or the request’s `?moduleKey=`)
- `entityId` is null **or** equals the invoice/record entity
- `minMinor` is null **or** `totalMinor >= minMinor`
- `maxMinor` is null **or** `totalMinor <= maxMinor`

First match wins:
- `autoApprove=true` → record is approved immediately (invoice path)
- otherwise → approval tasks for users with `assigneeRole` (or admin/approver/ap_manager if role is null)

If **no rule** matches, the default `ApprovalPolicy` for that `moduleKey` applies (Admin → Approvals → module tab).

Assignee selection then applies **SoD** (`SodPolicy`) on invoices — see [P3_E5_ADVANCED_SOD.md](./P3_E5_ADVANCED_SOD.md).

## API

| Method | Path |
|---|---|
| GET | `/api/workflow/policy?moduleKey=` |
| PATCH | `/api/workflow/policy?moduleKey=` (body may include `moduleKey`, `chainJson`) |
| GET | `/api/workflow/rules?moduleKey=` |
| POST | `/api/workflow/rules` (send `moduleKey`) |
| PATCH | `/api/workflow/rules/:id` |
| DELETE | `/api/workflow/rules/:id` |
| GET/PATCH/POST/DELETE | `/api/workflow/sod` (segregation of duties; invoices) |

Cross-module command aggregates: see [COMMAND_CENTER_AND_ADMIN.md](./COMMAND_CENTER_AND_ADMIN.md).
