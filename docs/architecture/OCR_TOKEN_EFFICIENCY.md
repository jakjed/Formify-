# OCR and token efficiency

Plan for leveraging invoice scanning **without re-spending OCR/API tokens** on every touch.

## Goals

1. **Billable transactions** (approved invoices) stay separate from **OCR page metering** — see [PRODUCT_BLUEPRINT.md](../PRODUCT_BLUEPRINT.md) §7.
2. Run Textract (or stub) **once per immutable file**, not on every HITL edit or re-open.
3. Prefer **local/stub extraction** when the file is already structured text.
4. Never re-OCR unchanged bytes after HITL corrections.

## Current behavior (Phase 1)

| Step | Token / meter impact |
| --- | --- |
| Upload or email ingest | One OCR pass per new `FileAsset` |
| `OCR_PROVIDER=stub` | No external tokens; parses `.txt` / placeholders locally |
| `OCR_PROVIDER=textract` | AWS AnalyzeExpense; counted in `OcrPageMeter` |
| HITL field edit | No re-OCR; writes to invoice fields only |
| Re-submit for approval | No re-OCR unless a **new attachment** is added |

OCR payload (including geometry) is persisted on `Invoice.ocrPayload` — see [HITL_OCR_GEOMETRY.md](./HITL_OCR_GEOMETRY.md).

## Planned optimizations

### A. Content-hash cache (per tenant)

- Compute SHA-256 of uploaded bytes at ingest.
- Before calling Textract, look up prior `FileAsset` / OCR result with same hash in tenant.
- **Reuse** stored `ocrPayload` and skip provider call → **zero additional OCR pages**.

### B. Stub-first routing

```
if mimetype is text/plain or CSV-like invoice export:
  use stub parser (no Textract)
else if PDF/image and hash cache hit:
  reuse ocrPayload
else if PDF/image:
  Textract once, persist payload + increment OcrPageMeter
```

### C. HITL without re-scan

- User corrections update invoice fields and audit trail only.
- Optional flag `ocrPayload.staleFields` when user overrides a boxed field (UI already shows geometry overlay).
- **Do not** trigger OCR on save, approve, or export.

### D. Re-OCR only on explicit events

Re-run OCR only when:

- New file version attached (new `FileAsset` id / hash).
- Admin “Re-scan document” action (future) with confirmation (counts pages).
- Provider failure retry (single retry, same hash — not a new meter tick if idempotent job id matches).

### E. LLM assist (future, optional)

If LLM is used for exception explanation or vendor matching:

- Input = **already extracted fields + OCR snippets**, not raw PDF each time.
- Cache LLM suggestions per `invoiceId + field + revision`.
- LLM usage is **not** mixed into OCR page metering.

## Metrics and guardrails

- `UsageEvent` / `OcrPageMeter`: increment only on **provider OCR calls**, not cache hits or stub.
- Invoice `notes` keeps `ocr:stub` / `ocr:textract` / `ocr:cache` for support.
- Soft/hard limits on approved invoices unchanged; OCR overage billed separately per blueprint.

## Implementation backlog

| Priority | Item | Effort |
| --- | --- | --- |
| P1 | File hash on `FileAsset`; cache lookup before Textract | Small schema + capture service |
| P1 | Stub route for `.txt` / structured imports | Capture/OCR service |
| P2 | Admin “OCR pages this month” already in Usage; add cache-hit counter | Usage API |
| P2 | Explicit re-scan action with meter warning | Invoice workspace |
| P3 | LLM assist behind feature flag with revision cache | Separate epic |

## Related docs

- [E2_CAPTURE.md](./E2_CAPTURE.md)
- [E4_IMPORT_TEXTRACT.md](./E4_IMPORT_TEXTRACT.md)
- [HITL_OCR_GEOMETRY.md](./HITL_OCR_GEOMETRY.md)
- [E5_EMAIL_NOTIFY_AUDIT.md](./E5_EMAIL_NOTIFY_AUDIT.md)
