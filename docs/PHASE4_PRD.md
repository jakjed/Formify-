# Phase 4 PRD — Live connectors & harden

## 1. Intent

After Phase 3 ecosystem foundation, ship **first production-shaped ERP connector** and continue go-live hardening — still no in-app payments.

## 2. Epic backlog

| Epic | Outcome |
|---|---|
| P4-E0 NetSuite connector | Available pack: mock/live credential connect + stub vendor-bill sync ✅ |
| P4-E1 SuiteTalk runtime | Real NetSuite TBA/OAuth HTTP vendor bill create (this slice) |
| P4-E2 QuickBooks Online | Second live pack |
| P4-E3 Go-live harden | SOC2 evidence hooks, approval reminders, export SLOs |

## 3. Exit (P4-E0)

- [x] `netsuite` pack status `available`  
- [x] Connect mock (token once) or live (hashed TBA consumer/token material)  
- [x] Sync → `IntegrationJob` type `sync_netsuite`  
- [x] Integration Center UI (form + sync/disconnect)  
- [x] Docs: this PRD + `P4_E0_NETSUITE_CONNECTOR.md`  

## 4. Exit (P4-E1)

- [x] TBA HMAC-SHA256 signer + SuiteTalk REST client  
- [x] Live sync POSTs vendorBill per approved invoice  
- [x] Secrets stored + redacted on connection list  
- [x] Docs: `P4_E1_SUITETALK_RUNTIME.md`  
