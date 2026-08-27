# P4-E2 — QuickBooks Online connector

## Scope

Second live ERP pack: **QuickBooks Online** bills via Intuit API.

- Pack key `quickbooks`, status `available`
- Connect mock (token once: `qbo_…`) or live (OAuth bearer + realm id)
- Live sync: `POST /v3/company/{realmId}/bill` per approved invoice
- Optional `baseUrl` override for gateways / test doubles
- Job type `sync_qbo`; successful invoices get `exportedAt`

## Connect

| Mode | Required | Optional |
|---|---|---|
| mock | — | `realmId`, `environment`, `expenseAccountId` |
| live | `realmId`, `accessToken` | `refreshToken`, `environment` (`sandbox`\|`production`), `expenseAccountId`, `baseUrl` |

Secrets are stored on `ConnectorConnection.settings` and redacted on list (`accessTokenSet` / `refreshTokenSet` flags only).

## Sync outcomes

| Result | Job |
|---|---|
| All bills HTTP 2xx (or mock) | `succeeded` |
| Mixed live | `succeeded` + `errorMessage` partial |
| All live failed | `failed` |

## Endpoints

- `POST /api/integration/connections/quickbooks/connect`
- `POST /api/integration/connections/quickbooks/disconnect`
- `POST /api/integration/connections/quickbooks/sync` (`exports:read`)

## Next

P4-E3 Go-live harden
