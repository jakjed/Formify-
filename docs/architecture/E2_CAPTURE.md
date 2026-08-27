# E2 — Document capture + invoice workspace

## Scope

- Shared **document extraction** (`DocumentExtractionService`) — SHA-256 cache, once per file
- `POST /api/capture/upload` — multipart file → storage + OCR → invoice `needs_review`
- `POST /api/contracts/scan-intake` — same pipeline with **contract** profile
- Invoice CRUD-ish: list, get, patch, resolve-exceptions, **approve** (records `invoice.approved` usage), void
- `GET /api/usage/summary` — approved count + OCR pages this month
- Web: Invoices list (upload), Invoice workspace (edit/approve); Contracts scan document

## Extraction cache

- `FileAsset.contentHash` deduplicates OCR within a tenant
- Cache hit skips provider call and OCR page meter (`ocr:cache` in notes)
- Extraction JSON stored on `FileAsset.extractionPayload`; invoices mirror fields on `Invoice.ocrPayload`

## Stub OCR

- Invoices: `.txt` with `vendor:`, `invoice #`, `total:`, `currency:` parse better
- Contracts: `.txt` with `title:`, `counterparty:`, `term:`, `value:`, etc.
- PDF/images get low-confidence placeholders + review flags
- Real **AWS Textract** (Analyze Expense for invoices) when `OCR_PROVIDER=textract`

See [OCR_TOKEN_EFFICIENCY.md](./OCR_TOKEN_EFFICIENCY.md) and [AI_DATA_POLICY.md](./AI_DATA_POLICY.md).

## Run

```bash
pnpm db:deploy
pnpm dev
```

Upload from **Invoices**, open the row, set total + number, **Approve**.
