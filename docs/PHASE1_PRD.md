# Procure Ledger Phase 1 PRD — AP Invoices (Web)

**Product:** Procure Ledger  
**Phase:** 1 — sellable wedge  
**SKU:** Procure Ledger AP (Platform Core + Invoices + Capture + Integration Center)  
**Client:** Cloud web only (desktop-first; tablet browser acceptable)  
**Status:** Ready for design & engineering breakdown  
**Depends on:** [PRODUCT_BLUEPRINT.md](./PRODUCT_BLUEPRINT.md)  
**Billing unit (locked):** `invoice.approved` = 1 billable transaction  

---

## 1. Goal

Ship a **ready-to-sell** multi-tenant web product that lets mid-market AP teams:

1. Capture supplier invoices (email, upload, API)  
2. Extract fields with AWS Textract + human-in-the-loop review  
3. Code, validate, approve  
4. Export **payment-ready** approved invoices via **Integration Center templates** (and read via API)  
5. Be metered on **approved invoice count** + OCR pages  

**Success for Phase 1:** a new tenant reaches first real `invoice.approved` → template export within one guided day; paying customers can run weekly AP on Procure Ledger without PR/PO/Contracts.

---

## 2. Non-goals (explicit)

| Out of scope | Notes |
|---|---|
| Mobile / React Native | Phase 1.5+ |
| Contracts, PR, PO, receiving, 2/3-way match | Phase 2 |
| ERP connectors (QBO, Xero, NetSuite, etc.) | Later; templates + API only |
| In-app payments / payment rails | Never required; status fields only |
| SSO / SAML / OIDC / SCIM | Architecture hooks only; password login at GA |
| Vendor portal | Later |
| Multi-currency FX rate service automation | Store currency on invoice; simple support OK; full FX engine later |
| AI auto-post without user/policy confirmation | Suggestions only |

---

## 3. Personas & jobs (Phase 1)

| Persona | Phase 1 jobs |
|---|---|
| **Tenant Admin** | Create users, roles, entities; configure capture mailbox; manage Integration Center; see usage |
| **AP Clerk** | Process capture queue, fix OCR/exceptions, code invoices, submit for approval or approve if permitted |
| **Approver** | Approve/reject invoices in My Work with amount + vendor + coding context |
| **AP Manager** | Monitor exception aging, STP, exports; adjust workflows & tolerances |

---

## 4. User journeys (acceptance narratives)

### J1 — First-value onboarding (&lt; 1 day)

1. Admin signs up / receives tenant → sets password → creates entity  
2. Invites one clerk + one approver (username/password)  
3. Downloads **Vendors** + **GL accounts** templates → uploads filled files in Integration Center  
4. Configures inbound capture email (or uses upload)  
5. Uploads 3 sample PDF invoices → OCR → clerk resolves → approver approves  
6. Downloads **Approved invoices export** template/job output for ERP/bank pay run  
7. Admin sees **3 billable transactions** (usage)

### J2 — Daily AP clearing

1. Invoices arrive via email/upload  
2. System extracts; high-confidence clean invoices may auto-route to approval or auto-approve per policy  
3. Clerk works **Exception queue** and **Needs review**  
4. Approvers clear **My Work**  
5. Clerk/admin runs export job for newly approved invoices  

### J3 — Exception recovery

1. Duplicate / bad vendor / missing GL flagged  
2. Clerk fixes in Invoice Workspace (side-by-side PDF)  
3. Re-validate → submit → approve  
4. Audit trail shows before/after  

---

## 5. Functional requirements

### 5.1 Platform Core (P0)

| ID | Requirement |
|---|---|
| P-01 | Multi-tenant isolation on every query/mutation |
| P-02 | Entity (legal company) under tenant; invoice belongs to one entity |
| P-03 | Users with username/password; invite, reset, lockout |
| P-04 | Roles + granular permissions (see §5.8) |
| P-05 | `AuthProviderConfig` model with `local` enabled; unused `oidc`/`saml` types reserved |
| P-06 | Module license flag: `invoices` enabled for Procure Ledger AP |
| P-07 | Notification center (in-app) + email for approval assigned / export failed |
| P-08 | Append-only audit log for auth, admin, invoice field/state changes |
| P-09 | Global search: invoices by number/vendor/amount; vendors; users (permissioned) |
| P-10 | Command palette `Cmd/Ctrl+K` for navigation + search |

### 5.2 Master data (P0)

| ID | Requirement |
|---|---|
| M-01 | Vendors: name, code, tax IDs, email, payment terms, status, external ID |
| M-02 | GL accounts, cost centers (optional), tax codes, payment terms |
| M-03 | CRUD in UI + Integration Center template upsert |
| M-04 | Soft-disable (don’t hard-delete if referenced) |

### 5.3 Capture & OCR (P0)

| ID | Requirement |
|---|---|
| C-01 | Upload PDF/PNG/JPEG (multi-file) |
| C-02 | Per-tenant inbound email address → creates capture items |
| C-03 | API endpoint to create invoice from file + metadata (API key) |
| C-04 | Pipeline: store file (S3) → virus scan → Textract → map fields → create/update invoice draft |
| C-05 | Extract at minimum: vendor name, invoice number, invoice date, due date, currency, subtotal, tax, total, line items when present |
| C-06 | Per-field confidence; below threshold → `NeedsReview` / exception `OCR_LOW` |
| C-07 | Meter OCR pages consumed per document |
| C-08 | Idempotent email ingest (Message-ID) to avoid duplicate capture |

### 5.4 Invoice processing (P0)

| ID | Requirement |
|---|---|
| I-01 | Invoice states: `Captured` → `Extracting` → `NeedsReview` → `Exception` → `InApproval` → `Approved` → `Exported` → `Void` (+ optional `Paid` status flag from import) |
| I-02 | Header fields editable under permission; all edits audited |
| I-03 | Line items editable (add/remove/edit); coding per line or header allocation |
| I-04 | Vendor match: exact / fuzzy against vendor master; unmatched → exception |
| I-05 | Duplicate detection: same vendor + invoice number (+ entity) within window |
| I-06 | Validation rules: required fields, total = lines+tax (tolerance), entity present |
| I-07 | Exception codes: `DUP`, `VENDOR_UNMATCHED`, `CODING`, `TAX`, `OCR_LOW`, `POLICY`, `ENTITY` |
| I-08 | Straight-through path: if validations pass + policy allows, skip NeedsReview |
| I-09 | Void approved invoice (permissioned); does **not** reverse billable count; new replacement invoice is a new billable event when approved |
| I-10 | Comments / @mentions on invoice |
| I-11 | Attachments additional to source document |

### 5.5 Workflows & approvals (P0)

| ID | Requirement |
|---|---|
| W-01 | Configurable approval rule: by amount threshold and/or entity (simple designer) |
| W-02 | Serial approvers; optional single parallel group (P0 = serial is enough if parallel slips) |
| W-03 | Approve / Reject / Request changes with comment |
| W-04 | Delegation: time-boxed delegate for approver |
| W-05 | Escalation email if task exceeds SLA hours (tenant setting) |
| W-06 | Policy: auto-approve under amount X for matched clean invoices (optional toggle) |
| W-07 | On transition to **`Approved`**: emit domain event `invoice.approved` and **increment billable usage by 1** (once per invoice id) |

### 5.6 Integration Center (P0)

| ID | Requirement |
|---|---|
| X-01 | Template catalog with versioned schemas |
| X-02 | Templates P0: Vendors upsert, GL accounts upsert, Cost centers upsert, **Approved invoices export**, Invoice status import (`Paid`/`Void`) |
| X-03 | Download blank template (XLSX/CSV) |
| X-04 | Upload → validate (dry-run) → show row errors → commit |
| X-05 | Export job: select date range / “not yet exported” approved invoices → generate file → mark `Exported` + `exported_at` |
| X-06 | Job history: status, actor, counts, error file download |
| X-07 | Permissions: who can import master data vs run exports |
| X-08 | **No** hosted ERP connectors in Phase 1 |

### 5.7 API foundation (P0)

| ID | Requirement |
|---|---|
| A-01 | OpenAPI 3 for core resources: auth session, vendors, invoices, files, integration jobs |
| A-02 | Tenant API keys (hashed); scopes: `invoices:read`, `invoices:write`, `masterdata:write`, `exports:read` |
| A-03 | List/get invoices; upload invoice document; fetch approved invoices since cursor |
| A-04 | Rate limit per tenant/key |

### 5.8 Permissions (P0 minimum)

`admin`, `ap_manager`, `ap_clerk`, `approver` presets + custom roles.

Capabilities include: `invoice.read`, `invoice.write`, `invoice.approve`, `invoice.void`, `masterdata.manage`, `integration.import`, `integration.export`, `user.manage`, `workflow.manage`, `billing.read`, `audit.read`.

### 5.9 Usage & billing hooks (P0)

| ID | Requirement |
|---|---|
| B-01 | `usage_events` table: `{ tenant_id, type, ref_id, at }` with `type=invoice.approved` unique on `(tenant_id, type, ref_id)` |
| B-02 | OCR page counters daily/monthly |
| B-03 | Admin **Usage** screen: MTD approved count vs plan soft/hard limit (enforce soft warn P0; hard block configurable P1) |
| B-04 | Plan/tier can be manual admin field in Phase 1 (no payment gateway required) |

### 5.10 Reporting (P0 light)

| ID | Requirement |
|---|---|
| R-01 | Dashboard: invoices by status, exception age, STP %, approved MTD, export backlog |
| R-02 | CSV export from any worklist |

---

## 6. Information architecture (web)

```text
Procure Ledger
├── My Work              (approvals + assigned exceptions)
├── Invoices
│   ├── All invoices
│   ├── Capture inbox
│   ├── Needs review
│   ├── Exceptions
│   └── Approved / Exported views (saved views)
├── Directory
│   ├── Vendors
│   ├── GL accounts
│   ├── Cost centers
│   └── Tax codes / terms
├── Integration Center
│   ├── Templates
│   ├── Import jobs
│   └── Export jobs
├── Analytics            (ops dashboard)
└── Admin
    ├── Users & roles
    ├── Entities
    ├── Workflows
    ├── Capture settings (email)
    ├── API keys
    ├── Module & plan / usage
    └── Audit log
```

Only licensed modules appear. Phase 1 shows Invoices only (plus platform areas).

---

## 7. Screen inventory

Priority: **P0 must ship for GA**, **P1 polish / speed**, **P2 later**.

### 7.1 Auth & shell

| # | Screen | P | Description | Magical bar |
|---|---|---|---|---|
| S01 | Login | P0 | Username/password | Fast, clear errors |
| S02 | Invite accept / set password | P0 | Tokenized invite | — |
| S03 | Reset password | P0 | Email flow | — |
| S04 | App shell | P0 | Nav, tenant/entity switcher, search, notifications | Calm, dense-optional |
| S05 | Command palette | P0 | Navigate + search | Keyboard-first |

### 7.2 My Work & invoices

| # | Screen | P | Description | Magical bar |
|---|---|---|---|---|
| S10 | My Work | P0 | Unified tasks: approve / fix assigned | Clear next action |
| S11 | Invoice list | P0 | Sort/filter/saved views/bulk | Best-in-class worklist |
| S12 | Capture inbox | P0 | New files & extracting status | Live status |
| S13 | Exception queue | P0 | Group by exception code; age | Smart grouping |
| S14 | **Invoice workspace** | P0 | PDF viewer + fields + lines + activity | **Hero screen** |
| S15 | Approval detail sheet | P0 | From My Work; approve/reject | &lt;30s decision |
| S16 | Bulk coding modal | P1 | Apply GL to selection | — |
| S17 | Saved view editor | P0 | Filters → named view | — |

### 7.3 Directory

| # | Screen | P | Description |
|---|---|---|---|
| S20 | Vendors list + detail | P0 | Incl. invoice history strip |
| S21 | GL / CC / tax / terms lists | P0 | Simple CRUD tables |

### 7.4 Integration Center

| # | Screen | P | Description | Magical bar |
|---|---|---|---|---|
| S30 | Integration home | P0 | Templates + recent jobs | First-class, not buried |
| S31 | Template detail | P0 | Download, schema help, upload |
| S32 | Import wizard | P0 | Upload → validate → commit |
| S33 | Export wizard | P0 | Criteria → run → download |
| S34 | Job detail | P0 | Row errors, retry, artifact |

### 7.5 Analytics & admin

| # | Screen | P | Description |
|---|---|---|---|
| S40 | Ops dashboard | P0 | KPIs in §5.10 |
| S50 | Users list / invite / edit | P0 | |
| S51 | Roles & permissions | P0 | |
| S52 | Entities | P0 | |
| S53 | Workflow list / editor | P0 | Simple; not BPMN spaghetti |
| S54 | Capture settings | P0 | Inbound email display + rotate |
| S55 | API keys | P0 | Create, scope, revoke |
| S56 | Usage & plan | P0 | Approved MTD + OCR pages |
| S57 | Audit log | P0 | Filter by object/actor/date |

### 7.6 Empty, error, system

| # | Screen | P | Notes |
|---|---|---|---|
| S70 | Empty states per list | P0 | CTA to upload / import template |
| S71 | 403 / 404 | P0 | |
| S72 | Pipeline failure toast + invoice banner | P0 | Requeue OCR |

**Phase 1 screen count P0:** ~28 screens/views (acceptable for wedge).

---

## 8. Invoice workspace UX spec (hero)

**Layout (desktop):**  

- Left ~55%: document canvas (PDF.js), page nav, zoom  
- Right ~45%: tabs **Fields | Lines | Exceptions | Activity**  
- Top bar: status chip, vendor, total, entity, primary actions (`Save`, `Submit`, `Approve` if permitted)

**Rules:**  

- Low-confidence fields visually marked; tab order jumps to next issue  
- Duplicate banner sticky with link to other invoice  
- Never auto-overwrite user edits on OCR re-run without confirm  
- Keyboard: `A` approve (if allowed), `E` focus first exception, `Cmd+S` save  

---

## 9. Domain model (sketch)

```text
Tenant
  Entity
  User / Role / PermissionAssignment
  AuthProviderConfig
  ModuleLicense
  Vendor
  GlAccount / CostCenter / TaxCode / PaymentTerm
  CaptureMailbox
  FileAsset
  Invoice
    InvoiceLine
    InvoiceException
    InvoiceComment
  ApprovalPolicy / ApprovalTask
  IntegrationTemplate / IntegrationJob / IntegrationJobRow
  ApiKey
  UsageEvent
  AuditEvent
  Notification
  SavedView
```

**Invoice money:** integer minor units + `currency` on header (and lines).

**State machine:** enforce legal transitions server-side; UI mirrors.

---

## 10. Technical delivery notes (Phase 1)

| Area | Choice |
|---|---|
| Web | React + TS + Vite; TanStack Query/Table; design tokens (Ledger Light) |
| API | NestJS modular monolith |
| DB | PostgreSQL |
| Files | S3 |
| OCR | AWS Textract (Analyze Expense + Queries as needed) |
| Jobs | SQS or BullMQ workers: OCR, email poll/webhook, export build |
| Auth | First-party local auth JWT/session |
| Hosting | AWS US + EU pin per tenant |

**Modules in monolith:** `identity`, `masterdata`, `invoices`, `capture`, `workflow`, `integration`, `usage`, `audit`, `notifications`.

---

## 11. Metrics & GA quality bar

| Metric | GA target direction |
|---|---|
| Time to first `invoice.approved` (guided) | &lt; 1 day |
| OCR pipeline p95 | &lt; 2 minutes |
| Approver decision time (median) | &lt; 30 seconds on My Work |
| Export job success | ≥ 99.5% |
| Cross-tenant isolation tests | 100% pass in CI |
| WCAG 2.2 AA on P0 screens | Required |
| Clerk unsupervised success | Process sample invoice after ~15 min |

---

## 12. Epic backlog (engineering)

| Epic | Outcome |
|---|---|
| E0 Foundation | Tenant, auth password, RBAC, audit, shell, flags |
| E1 Master data | Vendors/GL/CC + UI |
| E2 Capture pipeline | Upload, email, Textract, files, OCR metering |
| E3 Invoice workspace | CRUD, states, exceptions, duplicates, lists/views |
| E4 Workflows | Policies, tasks, My Work, `invoice.approved` + usage |
| E5 Integration Center | Templates, import/export jobs |
| E6 API keys & OpenAPI | External access foundation |
| E7 Analytics & usage UI | Dashboard + plan usage |
| E8 Hardening | Security review, load on lists, SOC2 logging evidence |

**Suggested build order:** E0 → E1 → E2 → E3 → E4 → E5 → E6/E7 → E8.

---

## 13. Test plan (minimum)

- Unit: state transitions; duplicate rules; usage uniqueness on approve  
- Integration: OCR worker happy path + failure retry  
- E2E (Playwright): J1 onboarding; approve → export; permission deny  
- Isolation: tenant A cannot read tenant B invoices by ID  
- Template: invalid CSV rows never partially commit without explicit “commit valid rows” mode (default = all-or-nothing)

---

## 14. Open Phase 1 micro-choices (defaults locked here)

| Topic | Default for build |
|---|---|
| Auto-approve under threshold | Off by default; admin can enable |
| Export marks `Exported` | Yes, when export job succeeds |
| Parallel approvals | Serial only in P0 |
| Hard paywall on volume | Soft warn P0; hard block flag ready P1 |
| Entity switcher | Required if tenant has &gt;1 entity |

---

## 15. Exit criteria — Phase 1 done

- [x] All P0 screens implemented to UX bar for S11–S14, S30–S34  
- [x] J1–J3 journeys pass E2E (API journey + Playwright bootstrap/deny)  
- [x] `invoice.approved` meters correctly once per invoice  
- [x] Integration Center exports payment-ready approved invoices  
- [x] Password auth + RBAC + audit in place  
- [x] US and EU residency pin documented and testable  
- [x] No connector or payment code paths that imply false roadmap  

---

## Appendix — Saved views to pre-seed

- My open approvals  
- Exceptions older than 2 days  
- Needs review  
- Approved not exported  
- Captured today  
- High amount (&gt; tenant threshold)
