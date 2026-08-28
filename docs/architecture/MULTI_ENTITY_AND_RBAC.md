# Multi-company (entity) data separation

## Recommendation for Aptora SaaS

**Default: one application instance and one shared database per region, with row-level isolation.**

| Layer | Mechanism | What it isolates |
| --- | --- | --- |
| **Tenant** | `tenantId` on every business row + auth session bound to tenant | Customer / company (billing customer). Hard wall between customers. |
| **Entity** | `entityId` + `UserEntityMembership` | Legal entities / books inside one tenant (e.g. Main vs JJLab). Users only see assigned entities; lists honor Entity filter (`All` = union of accessible entities). |

This is the standard pattern for multi-company AP/P2P SaaS (Coupa, Bill.com-style, NetSuite OneWorld-style logical books): **not** a separate database per legal entity.

## When to use a separate database

Use a dedicated database (or even a dedicated deployment) only when required by:

- Data residency / sovereignty contracts
- Strict regulatory isolation beyond app-layer controls
- Customer-managed / private cloud deals

Operational cost rises quickly (migrations, backups, connector credentials, support). Prefer shared DB + tenant + entity unless a deal requires otherwise.

## How Aptora enforces entity access

1. Assign users to entities in **Admin → Users** (memberships + default).
2. **Admins** always receive every entity from `GET /api/entities`.
3. **Non-admins** with memberships only receive assigned entities.
4. Transaction and Directory list APIs accept `entityId` (`all` or a UUID) and filter via `resolveEntityScope` / `scopedEntityWhere`.
5. Master data (vendors, GL, tax, terms, cost centers) carries optional `entityId` so coding catalogs can be entity-specific.

## Roles vs capabilities (clerk who also approves)

Primary **role** remains one of: `admin`, `ap_manager`, `ap_clerk`, `approver`.

Additional **capabilities** on the user (not separate roles):

- `canAccessDirectory` — authorized people may open Directory (admins always can).
- `canApprove` — e.g. an `ap_clerk` who is also an approver receives approval tasks without changing their primary role.

**Delegation:** Users manage their own rules via the **Account menu → Delegations** (`/account/delegation`). Admins oversee all tenant delegations at **Admin → Delegation** (revoke any; no create-on-behalf in Admin).

See also: `COMMAND_CENTER_AND_ADMIN.md`, `APPROVAL_RULES.md`.
