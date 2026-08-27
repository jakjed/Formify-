# Aptora Phase 3 PRD — Ecosystem

## 1. Intent

After AP Invoices (Phase 1) and Procure (Phase 2), open Aptora to **partners and ERPs** without in-app payments.

**Success for Phase 3 foundation:** tenants can register outbound webhooks, see planned connector packs in Integration Center, and continue template/API exports — with a clear path to OAuth connectors, SSO, and SCIM.

## 2. Scope box

| In | Out (still) |
|---|---|
| Outbound webhooks (signed) | Hosted ERP connector runtime (later epics) |
| Connector pack **registry** | Payment rails |
| Partner-ready API foundation | Mobile Expo (Phase 1.5 track) |

## 3. Epic backlog

| Epic | Outcome |
|---|---|
| P3-E0 Foundation | Webhooks + connector pack registry + PRD (this slice) |
| P3-E1 SSO OIDC | First IdP (Google or Entra) via `AuthProviderConfig` |
| P3-E2 Partner OAuth apps | OAuth2 client apps + scoped API access |
| P3-E3 SCIM | User provisioning |
| P3-E4 Connector runtime | First ERP pack (OAuth + sync jobs) |
| P3-E5 Advanced SoD | Segregation-of-duties policies beyond Phase 1 approvals |

## 4. Non-goals (foundation)

- Live NetSuite/QBO connectors  
- In-app payments  
- Full SOC2 evidence pack (ops process)

## 5. Exit (P3-E0)

- [x] `WebhookEndpoint` / `WebhookDelivery` + admin APIs  
- [x] Dispatch `invoice.approved` (HMAC)  
- [x] Connector pack registry API + Integration Center UI  
- [x] Docs: this PRD + architecture note  
