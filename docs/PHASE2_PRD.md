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
| P2-E1 Contracts workspace | Approvals, amendments, renewals, vendor link ✅ |
| P2-E2 PR → PO convert | Convert approved PR to PO draft; line carry-over ✅ |
| P2-E3 Receiving | Receive against PO lines; partial receive ✅ |
| P2-E4 Invoice match | 2/3-way match exceptions into Invoices when PO licensed ✅ |
| P2-E5 Integration | PR/PO/Contract templates + export jobs (this slice) |

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

## 8. Exit (P2-E2)

- [x] `POST /api/purchase-requests/:id/convert` (approved → draft PO)  
- [x] Line carry-over + PR status `converted`  
- [x] Requires `purchase_orders` license  
- [x] Web Convert action + PO↔PR links  
- [x] Docs: `P2_E2_PR_TO_PO.md`  

## 9. Exit (P2-E3)

- [x] `POST /api/purchase-orders/:id/receive` (partial + full)  
- [x] `receivedQty` updates + status derivation  
- [x] Web receive controls on Orders list  
- [x] Docs: `P2_E3_RECEIVING.md`  

## 10. Exit (P2-E4)

- [x] `Invoice.purchaseOrderId` + migration  
- [x] 2/3-way match codes (`PO_TOTAL`, `PO_VENDOR`, `PO_RECEIPT`) when Orders licensed  
- [x] Invoice workspace PO link  
- [x] Docs: `P2_E4_INVOICE_MATCH.md`  

## 11. Exit (P2-E5)

- [x] Contracts / PR / PO CSV templates in Integration Center  
- [x] License-gated export endpoints + job history  
- [x] Web export actions when modules enabled  
- [x] Docs: `P2_E5_INTEGRATION.md` + `PHASE2_COMPLETE.md`  

## Phase 2 track status

**Complete** for Contracts + PR + PO foundation (P2-E0…E5).  

