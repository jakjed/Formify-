# P3-E4 — Connector runtime

## Scope

First **connector runtime** slice: Demo ERP pack with mock connect + stub sync jobs.

- Registry marks `demo-erp` as `available` (others stay `planned`)
- `ConnectorConnection` stores hashed mock credentials per tenant/pack
- Sync creates `IntegrationJob` type `sync_demo_erp` and stub-pushes approved invoices
- Integration Center: Connect / Run sync / Disconnect

**Out of scope:** live NetSuite/QBO/Xero OAuth, refresh tokens, inbound ERP webhooks, job row detail table.

## Schema

`ConnectorConnection`: `tenantId`, `packKey`, `status` (`connected`|`disconnected`), `credentialsHash`, `settings` JSON.

`IntegrationJobType` adds `sync_demo_erp`.

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/integration/connector-packs` | Includes `demo-erp` available |
| GET | `/api/integration/connections` | No secrets |
| POST | `/api/integration/connections/demo-erp/connect` | Returns `accessToken` once |
| POST | `/api/integration/connections/demo-erp/disconnect` | Clears credentials |
| POST | `/api/integration/connections/demo-erp/sync` | Stub push + job; requires connected |

## UI

**Integration Center → Connector packs** — Demo ERP actions; recent jobs show `sync_demo_erp`.

## Next

P4-E0 NetSuite connector ✅ · P4-E1 SuiteTalk runtime · P4-E2 QuickBooks Online
