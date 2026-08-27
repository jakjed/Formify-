# P2-E2 — PR → PO convert

## Scope

Convert an **approved** purchase request into a **draft** purchase order with line carry-over.

## API

`POST /api/purchase-requests/:id/convert`

Requires:

- `purchase_requests` license (route guard)
- `purchase_orders` license (checked in service → 403 if off)

Optional body:

```json
{ "number": "PO-1001", "vendorId": "<uuid>", "contractId": "<uuid>" }
```

Default PO number: `PO-{pr.number}`.

Response: `{ purchaseRequest, purchaseOrder }` — PR status becomes `converted`.

## Behavior

- Only `approved` PRs; rejects if a PO is already linked
- Copies title, entity, currency, totals, notes, and all lines
- Atomic transaction (PO create + PR status)
- Audit: `pr.converted` + `po.created`

## Next

P2-E3 Receiving · P2-E4 Invoice match
