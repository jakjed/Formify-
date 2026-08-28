# AI & document processing — data handling policy

How Procure Ledger treats invoice and contract content when OCR or AI features are used. Written for sales, security review, and DPA conversations.

## Executive summary (for clients)

| Question | Answer |
| --- | --- |
| Are my invoices/contracts sent to ChatGPT or public AI websites? | **No.** Procure Ledger does not call OpenAI, ChatGPT, Claude, or other consumer LLM APIs in the product today. |
| Is any “AI” running now? | Contract summarize / red flags / AI intake are **local stubs** (deterministic text in our API). No model inference, no external call. |
| When OCR is on, where does data go? | Optional **AWS Textract** in your tenant’s region (same AWS account Procure Ledger hosts in). PDF/image bytes are processed for field extraction only. |
| Will you train models on our data? | **No.** Procure Ledger does not use customer documents to train foundation models. |
| Can we turn AI off? | **Yes.** OCR provider and any future LLM assist are **tenant-admin configurable**; default posture is conservative. |

---

## Current state (Phase 1 / 2)

### What leaves the Procure Ledger environment today

| Feature | External call? | What is sent |
| --- | --- | --- |
| Invoice upload + stub OCR | No | Parsed locally in API |
| Invoice upload + Textract | Yes → **AWS Textract** only | Document bytes to Analyze Expense in configured `AWS_REGION` |
| Contract AI intake / summarize / red flags | **No** | Stub strings generated inside Procure Ledger API |
| Email capture ingest | No (simulated webhook) | Stays in Procure Ledger storage |

There is **no LLM SDK**, no OpenAI/Anthropic/Bedrock integration in the codebase as of this document.

### What stays inside Procure Ledger

- Stored files (`FileAsset` / future contract binaries)
- Extracted fields and `ocrPayload` (geometry JSON)
- All HITL edits, approvals, audit events
- In-app notifications

See [RESIDENCY.md](./RESIDENCY.md) for US/EU tenant pinning.

---

## Planned AI (optional — not enabled by default)

When LLM assist is added (contract summaries, red-flag narrative, invoice exception hints), it will follow these **locked product rules**:

### 1. Opt-in per tenant

- Admin toggle: **AI assist: Off / On**
- Off = rule-based extraction + HITL only (no LLM calls)
- Documented in admin UI and order form / DPA schedule

### 2. No public consumer LLM APIs for production

Production will **not** route customer content to:

- chat.openai.com / OpenAI public API (unless customer brings a dedicated enterprise endpoint under their own contract — separate “BYO AI” mode)
- Public Claude, Gemini, or similar multi-tenant SaaS without zero-retention enterprise terms

Preferred stack when LLM is needed:

| Option | Data path | Typical use |
| --- | --- | --- |
| **A. Off** | Nothing leaves beyond OCR | Default; maximum privacy |
| **B. AWS Bedrock** | Same AWS region as tenant (`us-east-1` / `eu-west-1`) | Summaries, clause hints on **text only** |
| **C. Customer BYO endpoint** | Customer-controlled Azure OpenAI / private model | Enterprise deals |

### 3. Text snippets only — never re-send PDFs to LLM

LLM input = **already extracted text** and field values from `DocumentExtraction` / `ocrPayload`, not raw PDFs. Same rule as [OCR_TOKEN_EFFICIENCY.md](./OCR_TOKEN_EFFICIENCY.md).

### 4. No training on customer data

- Contractual commitment: customer content is **not** used to train Procure Ledger or third-party foundation models.
- Prefer Bedrock / Azure models with **no training** and **zero retention** inference settings where available.

### 5. Audit and transparency

- Audit events: `ai.summary_requested`, `ai.red_flags_scanned` with tenant, actor, record id — **not** full document text in audit meta.
- Admin usage view: LLM call count (separate meter from OCR pages).
- Subprocessor list in DPA: AWS (hosting, Textract, optional Bedrock).

### 6. EU / GDPR

- EU tenants: Textract and any LLM in **eu-west-1** (or EU Azure region for BYO).
- DPA + SCCs as per [PRODUCT_BLUEPRINT.md](../PRODUCT_BLUEPRINT.md) compliance roadmap.

---

## What to tell procurement / IT

> Procure Ledger’s default path is **scan once with AWS Textract in your region**, human review in our app, and **no generative AI**. Optional AI features, when offered, run in your cloud region on extracted text only, are off by default, and are never used to train public models. We do not send your documents to ChatGPT.

---

## Implementation checklist (engineering)

- [ ] Tenant setting: `aiAssistEnabled` (default `false`)
- [ ] Tenant setting: `llmProvider`: `none` | `bedrock` | `byo`
- [ ] Guard in AI service: refuse external call if `aiAssistEnabled === false`
- [ ] Bedrock in same region as `Tenant.region`
- [ ] Subprocessor page + DPA appendix updated before GA of LLM features
- [ ] Rename UI “Scan with AI” → “Scan document” until real OCR wired (avoid implying external LLM)

---

## Related

- [OCR_TOKEN_EFFICIENCY.md](./OCR_TOKEN_EFFICIENCY.md)
- [GABI_PROCURE_PARITY.md](./GABI_PROCURE_PARITY.md) — stubs documented
- [RESIDENCY.md](./RESIDENCY.md)
- [HOSTING.md](./HOSTING.md)
