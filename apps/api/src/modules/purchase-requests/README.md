# Purchase requests

Raise → approve → convert to PO (P2-E2).

`POST /api/purchase-requests/:id/convert` creates a draft PO with line carry-over when both `purchase_requests` and `purchase_orders` are licensed.
