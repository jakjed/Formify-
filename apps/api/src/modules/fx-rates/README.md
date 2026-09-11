# FX rates

Tenant-scoped exchange-rate tables with **daily history from 2020-01-01**.

| Key | Source | Base | Fetch |
|-----|--------|------|-------|
| `nbp` | Narodowy Bank Polski Table A | PLN | `api.nbp.pl` (≤93-day chunks) |
| `ecb` | European Central Bank reference | EUR | Frankfurter `providers=ECB` |
| `fred` | US Federal Reserve H.10 | USD | Frankfurter `providers=FRED` |
| `boe` | Bank of England spot | GBP | Frankfurter `providers=BOE` |

Each row is unique on `(tableId, quoteCurrency, asOfDate)`.

## Admin

**Admin → Finance → FX rates**

- **Sync** / **Sync all** — backfill missing history from 2020 + refresh latest
- Rate type tabs — NBP / ECB / Fed / BoE
- Filters: **Year**, **Month**, **Day**, currency
- **Rate date** column on every row
- **Use as active table** — sets `Tenant.activeFxTableId`

## API

- `GET /api/fx-rates`
- `GET /api/fx-rates/tables/:id?year=&month=&day=&quote=`
- `POST /api/fx-rates/sync` `{ "providerKey"?: "nbp"|"ecb"|"fred"|"boe", "backfill"?: true }`
- `POST /api/fx-rates/activate` `{ "tableId": "<uuid>" }`

Admin session required.
