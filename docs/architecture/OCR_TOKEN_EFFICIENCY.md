# Document intelligence — OCR, field recognition, token efficiency

Shared plan for **Invoices** and **Contracts**: scan once, recognize fields with geometry, human-in-the-loop (HITL), never re-pay for the same bytes.

Aligns with [PRODUCT_BLUEPRINT.md](../PRODUCT_BLUEPRINT.md) §7 — buy OCR, invest in HITL workspace, not base models.

---

## Is this how world-class tools do it?

**Yes — on the principles.** Leaders (Stampli, Coupa AP, Ironclad, Icertis, Kofax, Rossum-class) converge on the same architecture:

| Principle | World-class pattern | Procure Ledger today | Procure Ledger target |
| --- | --- | --- | --- |
| **Scan once per file version** | Immutable document → one extraction job; edits are human corrections on stored results | Invoices: yes on upload/ingest | + hash cache; contracts wired |
| **Structured payload + geometry** | Bounding boxes, confidence, field keys for click/drag HITL | Invoices: `ocrPayload` on `Invoice` | Same shape on `Contract` / `ContractDocument` |
| **HITL over re-OCR** | User fixes fields; system does not re-run OCR on save/approve | Invoices: yes | Contracts: same |
| **Provider by document type** | Invoice/expense model for AP docs; document/queries/LLM for legal text | Invoices: Textract Analyze Expense | Contracts: Analyze Document + Queries, then optional LLM on **text layer** |
| **Dedup / cache** | Same PDF uploaded twice → reuse extraction | Planned (hash on `FileAsset`) | Shared cache table |
| **Meter OCR pages, not edits** | Cloud OCR billed per page; STP and HITL are product value | `OcrPageMeter` | Same meter for contract pages |
| **LLM for interpretation, not vision** | Summaries, red flags, clause ID run on extracted text | Invoices: not yet; Contracts: **stub only** | LLM reads cached text + field hits |

What separates category leaders is not “OCR on every click” — it is **extraction quality + HITL speed + learning** (vendor/layout memory). Procure Ledger’s blueprint matches that: Textract for vision, Procure Ledger for workspace and workflow.

---

## Shared platform (Invoices + Contracts)

One internal pipeline; different **extractor profiles** by module.

```
Upload / email / API
        │
        ▼
  FileAsset (bytes + sha256 + mime)
        │
        ├─ cache hit? ──► reuse DocumentExtraction
        │
        ▼
  Route by docType
        │
   ┌────┴────┐
   ▼         ▼
invoice    contract
profile    profile
   │         │
   ▼         ▼
Analyze    Analyze Document
Expense    + Queries (clauses)
   │         │
   └────┬────┘
        ▼
 DocumentExtraction (versioned JSON)
   • fields[] with bbox + confidence
   • fullText (for search + LLM)
   • lines[] (invoices only)
   • provider, extractedAt, pageCount
        │
        ├─► Map to domain record (Invoice / Contract)
        └─► HITL workspace (shared UX patterns)
```

### Persistence (target schema)

| Artifact | Invoices (now) | Contracts (target) |
| --- | --- | --- |
| File bytes | `FileAsset` | `FileAsset` (link from `ContractDocument`) |
| Extraction JSON | `Invoice.ocrPayload` | `ContractDocument.extractionPayload` or shared `DocumentExtraction` row |
| Domain fields | Invoice columns | Contract columns (`termType`, `noticePeriod`, …) |
| AI interpretation | Future (exceptions) | `redFlagsJson`, summary — **from cached text**, not re-OCR |

Contracts today use **stub** AI intake and red-flag scan (`contracts.service.ts`); they do **not** yet share `OcrService`. Wiring contracts into the same pipeline is explicit backlog below.

---

## Invoice profile (implemented)

| Step | Token / meter impact |
| --- | --- |
| Upload or email ingest | One OCR pass per new `FileAsset` |
| `OCR_PROVIDER=stub` | No external tokens; parses `.txt` / placeholders locally |
| `OCR_PROVIDER=textract` | AWS **Analyze Expense**; counted in `OcrPageMeter` |
| HITL field edit | No re-OCR; writes to invoice fields only |
| Re-submit for approval | No re-OCR unless a **new attachment** is added |

See [HITL_OCR_GEOMETRY.md](./HITL_OCR_GEOMETRY.md) for payload shape.

---

## Contract profile (planned — same rules)

| Step | Behavior |
| --- | --- |
| Upload draft / executed PDF | One **Analyze Document** (or sync **Queries**) pass per new file hash |
| Field targets | Counterparty, effective dates, value, term, notice, governing law, auto-renewal, liability caps — each as `OcrFieldHit` with bbox where possible |
| Red-flag / AI summary | Run on **`fullText` + field hits** from stored extraction; **never** re-send PDF to OCR |
| HITL | Same drag-from-scan / geometry map as invoice workspace |
| Re-scan | Only on new document version or explicit “Re-scan” (counts pages) |

**Textract choice:** Invoices → **Analyze Expense** (tables, amounts). Contracts → **Analyze Document** + named **Queries** (clause-style fields). Optional LLM pass for narrative red flags — input is text, metered separately from OCR pages.

---

## Token efficiency rules (both modules)

### A. Content-hash cache (per tenant)

- SHA-256 at ingest on `FileAsset`.
- Before any provider call, lookup prior extraction with same hash.
- Reuse payload → **zero additional OCR pages** (`ocr:cache` in audit notes).

### B. Stub-first routing

```
if structured text / EDI / CSV export:
  local parser (no cloud OCR)
else if hash cache hit:
  reuse DocumentExtraction
else if docType == invoice:
  Textract Analyze Expense (once)
else if docType == contract:
  Textract Analyze Document + Queries (once)
```

### C. HITL without re-scan

- Corrections update domain fields + audit only.
- Track `staleFields` when user overrides a boxed value.
- No OCR on save, approve, export, or “Scan red flags”.

### D. Re-OCR only on explicit events

- New file version (new hash).
- User/admin **Re-scan document** (confirmation + page meter).
- Single idempotent retry after provider failure.

### E. LLM assist (optional, both modules — **off by default**)

Only when tenant admin enables AI assist. See [AI_DATA_POLICY.md](./AI_DATA_POLICY.md) — no public ChatGPT; prefer same-region Bedrock on extracted text only; never train on customer data.

| Use | Input | Not |
| --- | --- | --- |
| Invoice exception hints | Extracted fields + snippets | Raw PDF each time |
| Contract summary | Cached `fullText` + key fields | Re-OCR |
| Contract red flags | Cached `fullText` + clause hits | Re-OCR |

Cache LLM output per `recordId + field + documentHash`.

---

## Metrics and guardrails

- `OcrPageMeter`: increment only on **provider OCR calls** (Analyze Expense / Analyze Document pages), not cache hits or stub.
- Billable transactions (`invoice.approved`) stay separate from OCR — see blueprint §7.
- Contract volume metering (when sold) should follow the same pattern: **approved/active contract events**, not per-field edit.

---

## Implementation backlog

| Priority | Item | Modules |
| --- | --- | --- |
| P0 | **`DocumentExtraction` or extend `FileAsset`** with `contentHash`, `extractionPayload`, `fullText` | Shared |
| P0 | Hash lookup before Textract | Invoices, then Contracts |
| P1 | Contract upload → shared `OcrService` with **contract profile** | Contracts |
| P1 | Persist extraction on `ContractDocument`; HITL geometry in contract workspace | Contracts |
| P1 | Red-flag / AI summary reads cached text only | Contracts |
| P2 | Cache-hit counter in Admin Usage | Shared |
| P2 | Explicit re-scan with meter warning | Both workspaces |
| P3 | Per-vendor / per-layout learning (field location hints) | Both |
| P3 | LLM assist with revision cache | Both |

---

## Related docs

- [E2_CAPTURE.md](./E2_CAPTURE.md)
- [E4_IMPORT_TEXTRACT.md](./E4_IMPORT_TEXTRACT.md)
- [HITL_OCR_GEOMETRY.md](./HITL_OCR_GEOMETRY.md)
- [P2_E1_CONTRACTS_WORKSPACE.md](./P2_E1_CONTRACTS_WORKSPACE.md)
