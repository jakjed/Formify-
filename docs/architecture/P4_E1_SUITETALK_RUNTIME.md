# P4-E1 — SuiteTalk runtime

## Scope

Real **NetSuite SuiteTalk REST** vendor-bill create on sync (live mode).

- TBA OAuth 1.0 **HMAC-SHA256** request signing
- `POST /services/rest/record/v1/vendorBill` per approved invoice
- Live connect stores TBA secrets in `ConnectorConnection.settings` (redacted on list)
- Optional `baseUrl` override for gateways / test doubles
- Mock mode unchanged (local stub CSV job)

## Auth

Requires all four TBA values: consumer key/secret + token id/secret + account id.

## Sync outcomes

| Result | Job |
|---|---|
| All bills HTTP 2xx | `succeeded` |
| Mixed | `succeeded` + `errorMessage` partial |
| All failed | `failed` |

Successful invoices get `exportedAt` set.

## Next

P4-E2 QuickBooks Online · P4-E3 Go-live harden
