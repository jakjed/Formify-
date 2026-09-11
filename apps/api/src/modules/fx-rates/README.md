# FX rates

Tenant-scoped exchange-rate tables synced from **free official sources** (no API keys):

| Key | Source | Base | Fetch |
|-----|--------|------|-------|
| `nbp` | Narodowy Bank Polski Table A | PLN | `api.nbp.pl` |
| `ecb` | European Central Bank reference | EUR | Frankfurter `providers=ECB` |
| `fred` | US Federal Reserve H.10 | USD | Frankfurter `providers=FRED` |
| `boe` | Bank of England spot | GBP | Frankfurter `providers=BOE` |

CBOE does not offer a free mid-rate FX API; **ECB** is the EU official reference table used instead.

## Admin

**Admin → Finance → FX rates**

- **Sync** / **Sync all** — pull latest published rates
- Rate type tabs — switch between NBP / ECB / Fed / BoE
- **Use as active table** — sets `Tenant.activeFxTableId`

## API

- `GET /api/fx-rates`
- `GET /api/fx-rates/tables/:id`
- `POST /api/fx-rates/sync` `{ "providerKey"?: "nbp"|"ecb"|"fred"|"boe" }`
- `POST /api/fx-rates/activate` `{ "tableId": "<uuid>" }`

Admin session required.
