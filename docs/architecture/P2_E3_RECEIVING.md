# P2-E3 — Receiving

## Scope

Receive goods against issued PO lines — partial or full — and derive status.

## API

`POST /api/purchase-orders/:id/receive`

```json
{ "lines": [{ "lineNo": 1, "quantity": 1 }] }
```

Omit `lines` to receive **all remaining** quantity on every line.

Rules:

- PO must be `issued` or `partially_received`
- Cannot over-receive vs ordered qty
- Status → `partially_received` or `received` from line totals
- Audit: `po.received`

Status transitions for issue/cancel/close stay on `POST :id/transition` (receiving no longer uses manual `received` / `partially_received` jumps).

## Next

P2-E4 Invoice match · P2-E5 Integration
