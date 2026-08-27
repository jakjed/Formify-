# Gabi / Ledgerline procure parity

Maps the Gabi (`docs/Gabi_draft`) / Ledgerline P2P prototype surfaces onto Aptora API + web UI.

## Gap → implemented

| Gabi surface | Aptora API | Web UI |
|---|---|---|
| Contract Setup search / status filter | `GET /api/contracts?q=&status=` | Contracts → **Setup** |
| New contract + CLM / owner / term fields | `POST /api/contracts` | Setup → **+ New Contract** |
| Upload from supplier & AI scan | `POST /api/contracts/ai-intake` (stub) | Setup → **Upload… Scan with AI** |
| Send for Approval | `POST /api/contracts/:id/send-for-approval` | Setup / Approval / workspace |
| Approval chain (Budget Owner → … → Finance) | `approvalStage` + `POST …/advance-approval` | Approval tab + workspace stepper |
| DocuSign send / poll / complete | `send-for-signature`, `check-signature`, `complete-signature` | Signature tab + workspace |
| Contract detail fields, docs, AI summarize / red flags | PATCH, documents CRUD, `ai-summarize`, `scan-red-flags` | `/contracts/:id` workspace |
| PR proposals from signed contracts | `GET /api/purchase-requests/proposals`, `POST …/accept` | PR → **Proposals** |
| PR dept / category | create body `department`, `category` | PR create form + list |
| PO invoiced / remaining | list enriches `invoicedMinor`, `remainingMinor` | Orders list |
| AP accruals from open POs | `GET/POST /api/accruals…` | Orders → **Accruals** |

## Mock vs live

| Capability | Mode | Notes |
|---|---|---|
| DocuSign | **Mock** | Envelope IDs (`DS-…`), signer advance on check, no external API |
| AI intake / summarize / red flags | **Stub** | Deterministic text + sample flags; no LLM / file OCR |
| Accrual post to ERP | **Mock** | Status → `posted` + audit; no connector call |
| Contract documents | **Metadata only** | `category` + `fileName`; no binary storage in this slice |
| Approval chains | **In-app stages** | Contract: 5 stages; Accrual: AP Manager → Controller |

## Status vocabulary

Aptora uses snake_case statuses (`draft`, `in_approval`, `pending_signature`, `active`, …) rather than Gabi’s display labels (`Draft`, `Under Approval`, `Pending Signature`, `Signed`).

## Related

- Backend landed in the same branch as the procure parity API work.
- See also [P2_E1_CONTRACTS_WORKSPACE.md](./P2_E1_CONTRACTS_WORKSPACE.md) and [P2_E2_PR_TO_PO.md](./P2_E2_PR_TO_PO.md).
