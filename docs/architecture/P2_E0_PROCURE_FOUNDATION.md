# P2-E0 — Procure foundation

## Scope

Kick off Phase 2 (Contracts + PR + PO):

- Prisma models + migration
- Module licenses (`contracts`, `purchase_requests`, `purchase_orders`) default off
- CRUD + status transition APIs behind `ModuleLicenseGuard`
- Web list pages + license-gated nav
- Admin → Modules toggle

## APIs

| Method | Path | Module |
|---|---|---|
| GET/PATCH | `/api/modules`, `/api/modules/:key` | platform |
| GET/POST | `/api/contracts` | contracts |
| POST | `/api/contracts/:id/transition` | contracts |
| GET/POST | `/api/purchase-requests` | purchase_requests |
| POST | `/api/purchase-requests/:id/transition` | purchase_requests |
| GET/POST | `/api/purchase-orders` | purchase_orders |
| POST | `/api/purchase-orders/:id/transition` | purchase_orders |

## Next

P2-E1 Contracts workspace ✅ · P2-E2 PR→PO convert ✅ · P2-E3 receiving · P2-E4 invoice match
