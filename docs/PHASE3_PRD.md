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
| P3-E0 Foundation | Webhooks + connector pack registry + PRD ✅ |
| P3-E1 SSO OIDC | First IdP (Google or Entra) via `AuthProviderConfig` (this slice) |
| P3-E2 Partner OAuth apps | OAuth2 client apps + scoped API access ✅ |
| P3-E3 SCIM | User provisioning ✅ |
| P3-E4 Connector runtime | First ERP pack (OAuth + sync jobs) ✅ |
| P3-E5 Advanced SoD | Segregation-of-duties policies beyond Phase 1 approvals (this slice) |

## 4. Non-goals (foundation)

- Live NetSuite/QBO connectors  
- In-app payments  
- Full SOC2 evidence pack (ops process)

## 5. Exit (P3-E0)

- [x] `WebhookEndpoint` / `WebhookDelivery` + admin APIs  
- [x] Dispatch `invoice.approved` (HMAC)  
- [x] Connector pack registry API + Integration Center UI  
- [x] Docs: this PRD + architecture note  

## 6. Exit (P3-E1)

- [x] Tenant-aware `/api/auth/providers`  
- [x] Admin OIDC configure (mock + live)  
- [x] OIDC start/callback + session mint  
- [x] Login SSO button + `/auth/callback`  
- [x] Docs: `P3_E1_SSO_OIDC.md`  

## 7. Exit (P3-E2)

- [x] `OAuthClient` / `OAuthAccessToken` models + migration  
- [x] Admin CRUD + revoke for partner apps  
- [x] `POST /api/oauth/token` client_credentials → scoped bearer  
- [x] AuthGuard resolves `aptoauth_` tokens with `@RequireScopes`  
- [x] Admin → OAuth apps UI  
- [x] Docs: `P3_E2_PARTNER_OAUTH.md`  

## 8. Exit (P3-E3)

- [x] `scim:read` / `scim:write` on API key (+ OAuth) scopes  
- [x] `/api/scim/v2/Users` GET/POST/PATCH + DELETE→deactivate  
- [x] Map to existing `User`; SSO-ready active users (null password)  
- [x] Docs: `P3_E3_SCIM.md`  

## 9. Exit (P3-E4)

- [x] `ConnectorConnection` + `demo-erp` pack available  
- [x] Mock connect/disconnect (hashed credentials)  
- [x] Sync creates runnable `IntegrationJob` (`sync_demo_erp`)  
- [x] Integration Center connect + sync + job status  
- [x] Docs: `P3_E4_CONNECTOR_RUNTIME.md`  

## 10. Exit (P3-E5)

- [x] `SodPolicy` + `Invoice.submittedById` + migration  
- [x] Enforce on submit (filter assignees; no empty-pool self-approve when SoD on)  
- [x] Enforce on `decideTask` / force approve  
- [x] Admin → Approvals SoD section  
- [x] Docs: `P3_E5_ADVANCED_SOD.md`  
