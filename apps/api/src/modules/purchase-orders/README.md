# Purchase orders

Issue → receive → close.

`POST /api/purchase-orders/:id/receive` updates `receivedQty` and derives `partially_received` / `received` (P2-E3).
