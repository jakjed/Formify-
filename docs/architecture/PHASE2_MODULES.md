# Phase 2 modules

Second commercial flow after Invoices. Module keys:

| Key | API | Web |
|---|---|---|
| `contracts` | `apps/api/src/modules/contracts` | `apps/web/src/modules/contracts` |
| `purchase_requests` | `apps/api/src/modules/purchase-requests` | `apps/web/src/modules/purchase-requests` |
| `purchase_orders` | `apps/api/src/modules/purchase-orders` | `apps/web/src/modules/purchase-orders` |

Licenses default **off** for new tenants. Admin → Modules to enable. Routes return 403 when unlicensed (`ModuleLicenseGuard`).

See [PHASE2_PRD.md](../PHASE2_PRD.md) and [P2_E0_PROCURE_FOUNDATION.md](./P2_E0_PROCURE_FOUNDATION.md).
