# P3-E5 — Advanced segregation of duties

## Scope

Tenant **SoD policies** for invoice approvals beyond the Phase 1 “exclude submitter” filter.

- Default rule: `cannot_approve_own_invoice` (enabled)
- Optional: `role_pair_conflict` (submitter role X cannot be approved by role Y)
- Persist `Invoice.submittedById` on submit
- Enforce on assignee selection, task approve, and force-approve

**Out of scope:** multi-step serial SoD matrices, PR/contract SoD, delegation/escalation.

## Schema

`SodPolicy`: `ruleKey`, `enabled`, optional `submitterRole` / `approverRole`.  
`Invoice.submittedById` for correlation.

## Enforce

| Point | Behavior |
|---|---|
| Submit assignee pool | Drop submitter when own-approve SoD on; drop conflicting roles |
| Empty pool + SoD on | **Reject submit** (no self auto-approve) |
| Policy/rule auto-approve | Still allowed (system threshold, not human self-approve) |
| `decideTask` approve | Block own + role-pair |
| Force approve | Same `assertCanApprove` check |

## APIs

| Method | Path |
|---|---|
| GET | `/api/workflow/sod` |
| PATCH | `/api/workflow/sod/:id` |
| POST | `/api/workflow/sod/role-pair` |
| DELETE | `/api/workflow/sod/:id` (role-pair only) |

## Admin UI

**Admin → Approvals → Segregation of duties** — toggle defaults, add role-pair rules.

## Phase 3 complete

P3-E0…E5 foundation epic set is shipped. Live ERP OAuth packs remain follow-ons under Integration Center.
