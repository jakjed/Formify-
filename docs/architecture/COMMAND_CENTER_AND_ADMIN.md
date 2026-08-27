# Command Center & Admin (entity membership, multi-module approvals)

Cross-module command surfaces and admin capabilities that sit on top of Phase 1 AP and Phase 2 Procure.

## Sticky shell navigation

`AppShell` keeps the left nav sticky within the viewport:

- Brand + entity switcher stay pinned at the top
- Nav links scroll independently when the list grows
- Sign-out / muted links stay in a footer block
- Main content scrolls in `.shell__main` and expands fluidly (`minmax(0, 1fr)`)
- Nav can collapse to a narrow rail (persisted in session)

Nav groups: **Command** (Command Center, Operations), **Workspaces** (Contracts → Requisitions → Orders → Invoices), **Platform**. Exceptions is not a top-level Workspace item — open from Invoices via the Open exceptions view.

Entity switcher first option is **All** (union of entities the user can access). Assignment to entities restricts both the switcher and list APIs.

See also: `MULTI_ENTITY_AND_RBAC.md`.

## Command Center (`/`)

Home is **Command Center** (formerly My Work).

| Source | Use |
|---|---|
| `GET /api/ops/command-center` | Cross-module KPI aggregates + “needs attention” counts |
| `GET /api/approvals/my-work` | Invoice approval tasks with approve/reject actions |

UI blocks:

1. KPI tiles → Contracts / Requests / Orders / Invoices / Exceptions / Accruals
2. **Needs your attention** — invoice task rail + counts for contracts / PRs / accruals in approval
3. Snapshot panels for invoices, contracts, requests & orders, accruals

## Operations (`/ops`)

Operations combines:

- `GET /api/ops/dashboard` — AP open work, exception aging, usage
- `GET /api/ops/command-center` — procure KPIs (contracts, PR, PO, accruals)

## User ↔ entity membership

Users may belong to one or more entities (`UserEntityMembership`).

| API | Notes |
|---|---|
| `GET /api/users?q=` | List/search; includes `entityMemberships` + `defaultEntityId` |
| `POST /api/users` | Optional `entityIds` + `defaultEntityId` |
| `POST /api/users/invite` | Same membership fields |
| `PATCH /api/users/:id` | Update profile, status, `entityIds`, `defaultEntityId` |
| `GET /api/entities` | Non-admins see only membership entities |

Admin → Users: searchable data table (Name, Email, Role, Status, Entities, Actions) with an edit composer for memberships.

## Cross-module approval policies

`ApprovalPolicy` / `ApprovalRule` are scoped by `moduleKey`:

`invoices` | `contracts` | `purchase_requests` | `purchase_orders` | `accruals`

- Invoice policies keep auto-approve thresholds
- Other modules store stage chains in `chainJson` (comma-separated in Admin UI)
- Admin → Approvals uses module tabs; load/save/rules pass `?moduleKey=`

See [APPROVAL_RULES.md](./APPROVAL_RULES.md).

## Editable procure records

| Record | Editable when | Endpoint |
|---|---|---|
| Purchase request | `draft`, `in_approval` | `PATCH /api/purchase-requests/:id` |
| Purchase order | `draft` | `PATCH /api/purchase-orders/:id` |
| Contract | `draft`, `in_approval` (+ limited active) | existing contract PATCH |

UI shows **Edit** composers on Requests and Orders lists; contracts keep workspace edit.

## Approval progress UI

Shared `ApprovalProgress` (bar + stepper) is used on:

- Contract workspace (when `in_approval` or stage &gt; 0)
- Contracts list approval cards
- Purchase requests in approval (`PR_APPROVAL_CHAIN`)
- Accrual cards on Orders
