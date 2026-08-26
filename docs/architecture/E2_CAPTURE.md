# E2 — Capture + invoice workspace

## Scope

- `POST /api/capture/upload` — multipart file → local storage + stub OCR → invoice `needs_review`
- Invoice CRUD-ish: list, get, patch, resolve-exceptions, **approve** (records `invoice.approved` usage), void
- `GET /api/usage/summary` — approved count + OCR pages this month
- Web: Invoices list (upload), Invoice workspace (edit/approve)

## Stub OCR

- `.txt` files with `vendor:`, `invoice #`, `total:`, `currency:` parse better
- PDF/images get low-confidence placeholders + `OCR_LOW` / `VENDOR_UNMATCHED`
- Real **AWS Textract** wires in later without changing the invoice model

## Run

```bash
pnpm db:deploy
pnpm dev
```

Upload from **Invoices**, open the row, set total + number, **Approve**.
