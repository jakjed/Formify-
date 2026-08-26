# E4 — CSV import + optional Textract

## Integration imports

- `POST /api/integration/imports/vendors` (multipart `file`)
- `POST /api/integration/imports/gl-accounts` (multipart `file`)
- Upsert by `code` within tenant; job history records row counts/errors
- Templates: `vendors-import`, `gl-accounts-import`

## OCR providers

| `OCR_PROVIDER` | Behavior |
|---|---|
| `stub` (default) | Local parse / placeholders |
| `textract` | AWS Textract AnalyzeExpense; falls back to stub on failure |

Set AWS credentials + `AWS_REGION` when enabling Textract.

Invoice `notes` records `ocr:stub` or `ocr:textract` for traceability.
