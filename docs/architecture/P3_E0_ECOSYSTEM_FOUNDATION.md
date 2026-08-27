# P3-E0 — Ecosystem foundation

## Scope

Kick off Phase 3:

- Outbound webhooks (CRUD + signed delivery + history)
- Connector pack **registry** (planned ERP packs — no runtime OAuth yet)
- Phase 3 PRD

## APIs

| Method | Path | Notes |
|---|---|---|
| GET | `/api/webhooks/events` | Supported event names |
| GET/POST | `/api/webhooks/endpoints` | Admin |
| PATCH/DELETE | `/api/webhooks/endpoints/:id` | Admin |
| GET | `/api/webhooks/deliveries` | Admin |
| GET | `/api/integration/connector-packs` | Registry |

Dispatch today: `invoice.approved` after force/approve.

Headers on delivery: `X-Aptora-Event`, `X-Aptora-Signature: sha256=…`

## Next

P3-E1 SSO OIDC · P3-E2 Partner OAuth · P3-E3 SCIM · P3-E4 Connector runtime
