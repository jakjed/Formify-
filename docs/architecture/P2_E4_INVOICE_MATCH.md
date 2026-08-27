# P2-E4 — Invoice ↔ PO match

## Scope

When **purchase_orders** is licensed and an invoice links a PO:

| Code | Rule |
|---|---|
| `PO_VENDOR` | Invoice vendor ≠ PO vendor |
| `PO_TOTAL` | 2-way: totals differ beyond ±1 minor |
| `PO_RECEIPT` | 3-way: PO not `partially_received` / `received` / `closed` |

Skipped entirely when Orders module is off or no `purchaseOrderId`.

## Schema

`Invoice.purchaseOrderId` → `PurchaseOrder` (nullable FK)

## API / UI

- `PATCH /api/invoices/:id` accepts `purchaseOrderId`
- Validation sync includes PO codes in managed exceptions
- Invoice workspace shows PO select when Orders licensed

## Next

P2-E5 Integration ✅ — Phase 2 Procure track complete
