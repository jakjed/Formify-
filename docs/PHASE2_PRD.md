# Aptora Phase 2 PRD — Procure (Contracts + PR + PO)

## 1. Intent

Second commercial flow after AP Invoices. Finance/procurement teams enable **Contracts**, **Purchase Requests**, and **Purchase Orders** independently via `ModuleLicense` — without rip-and-replace of the invoices wedge.

**Success for Phase 2 foundation:** a licensed tenant can create a contract, raise a PR, convert/issue a PO, and see module-gated nav; invoice 2/3-way match hooks come in later slices.

## 2. Modules

| Module key | Alone | With Invoices |
|---|---|---|
| `contracts` | Draft → approve → active → expire/cancel | Link on PO / later invoice validate |
| `purchase_requests` | Create → approve → convert or export | Optional invoice reference |
| `purchase_orders` | Issue → receive → close | Match-ready for invoices |

Default for new tenants: Phase 2 modules **off** until admin enables them. `invoices` stays on.

## 3. States (P0)

**Contract:** `draft` → `in_approval` → `active` → `expired` | `cancelled`  
**PR:** `draft` → `in_approval` → `approved` → `converted` | `cancelled`  
**PO:** `draft` → `issued` → `partially_received` → `received` → `closed` | `cancelled`

## 4. Epic backlog (engineering)

| Epic | Outcome |
|---|---|
| P2-E0 Foundation | Schema, licenses, CRUD APIs, nav, admin enable ✅ |
| P2-E1 Contracts workspace | Approvals, amendments, renewals, vendor link (this slice) |
| P2-E2 PR → PO convert | Convert approved PR to PO draft; line carry-over |
| P2-E3 Receiving | Receive against PO lines; partial receive |
| P2-E4 Invoice match | 2/3-way match exceptions into Invoices when PO licensed |
| P2-E5 Integration | PR/PO/Contract templates + export jobs |

## 5. Non-goals (foundation)

- ERP connectors / payments  
- Full BPMN / parallel SoD matrices  
- Vendor portal  
- Mobile

## 6. Exit (P2-E0)

- [x] Prisma models for Contract / PR / PO (+ lines)  
- [x] Module license keys + admin toggle  
- [x] CRUD list/detail APIs behind license check  
- [x] Web nav + list pages when licensed  
- [x] Docs: this PRD + architecture note  

## 7. Exit (P2-E1)

- [x] Contract detail workspace (`/contracts/:id`)  
- [x] Vendor / entity link + PATCH edit  
- [x] Amend + renew for active contracts  
- [x] Comments + activity timeline  
- [x] Docs: `P2_E1_CONTRACTS_WORKSPACE.md`  
