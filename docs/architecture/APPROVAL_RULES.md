# Approval rules (entity / amount bands)

On submit, Aptora evaluates **enabled** `ApprovalRule` rows for the tenant, highest `priority` first.

A rule matches when:
- `entityId` is null **or** equals the invoice entity
- `minMinor` is null **or** `totalMinor >= minMinor`
- `maxMinor` is null **or** `totalMinor <= maxMinor`

First match wins:
- `autoApprove=true` → invoice is approved immediately
- otherwise → approval tasks for users with `assigneeRole` (or admin/approver/ap_manager if role is null)

If **no rule** matches, the default `ApprovalPolicy.autoApproveUnderMinor` threshold applies (Admin → Approvals).

Assignee selection then applies **SoD** (`SodPolicy`) — see [P3_E5_ADVANCED_SOD.md](./P3_E5_ADVANCED_SOD.md).

## API

| Method | Path |
|---|---|
| GET | `/api/workflow/rules` |
| POST | `/api/workflow/rules` |
| PATCH | `/api/workflow/rules/:id` |
| DELETE | `/api/workflow/rules/:id` |
| GET/PATCH | `/api/workflow/policy` (fallback) |
| GET/PATCH/POST/DELETE | `/api/workflow/sod` (segregation of duties) |
