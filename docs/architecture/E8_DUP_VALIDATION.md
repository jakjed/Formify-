# E8 — Duplicate detection & validation

## Scope

- Shared `InvoiceValidationService` (invoice-rules module)
- Rules: required number/total/currency/entity/vendor; total ≈ subtotal+tax (±1); **DUP** same vendor + invoice # within 365d
- Managed exception codes: `DUP`, `VENDOR_UNMATCHED`, `CODING`, `TAX`, `ENTITY` (OCR codes preserved)
- Sync on capture, save, explicit validate; **block** submit/approve while blocking issues remain

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/invoices/:id/validation` | Evaluate + sync exceptions |
| POST | `/api/invoices/:id/validate` | Same (write scope) |
| PATCH/submit/approve | existing | Save syncs; submit/approve gate |

## UI

Invoice workspace shows validation/exceptions and a link to the duplicate original when `DUP`.
