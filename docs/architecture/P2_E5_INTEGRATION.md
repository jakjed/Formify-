# P2-E5 — Procure Integration templates + export

## Scope

Extend Integration Center for Contracts / PR / PO:

- CSV template catalog entries (blank download)
- License-gated export jobs + `IntegrationJob` history

## Templates

| Key | Module |
|---|---|
| `contracts-export` | contracts |
| `purchase-requests-export` | purchase_requests |
| `purchase-orders-export` | purchase_orders |

## Export APIs

| Method | Path | License |
|---|---|---|
| POST | `/api/integration/exports/contracts` | contracts |
| POST | `/api/integration/exports/purchase-requests` | purchase_requests |
| POST | `/api/integration/exports/purchase-orders` | purchase_orders |

Approved-invoice export also includes `purchase_order_id` column.

## Web

Integration Center shows procure export buttons when the corresponding module is enabled.

## Phase 2 track

P2-E0…E5 complete for Contracts + PR + PO foundation.
