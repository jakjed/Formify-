# Phase 1 complete — Aptora AP Invoices (web wedge)

Phase 1 engineering track is closed on `main` through E13.

## What “done” means

Per [PHASE1_PRD.md](../PHASE1_PRD.md) §15:

- Invoice worklist, workspace, exceptions, Integration Center, ops dashboard
- Auth: password, invites, reset, lockout, RBAC presets, audit
- Capture: upload + email ingest + stub/Textract OCR
- Workflow: submit / My Work / approve + usage meter on `invoice.approved`
- API keys + OpenAPI (`/api/docs`)
- Hardening: rate limits, residency pin docs, isolation test, CSV export, command palette

## How to verify

```bash
pnpm db:up && pnpm install && pnpm --filter @aptora/types build && pnpm db:deploy
pnpm --filter @aptora/api build && pnpm --filter @aptora/api start   # :3001
pnpm --filter @aptora/web dev                                       # :5173

# Isolation + unit
pnpm --filter @aptora/api test

# Live API journeys (J1–J3)
RUN_JOURNEY=1 pnpm --filter @aptora/api test -- phase1.journey

# Playwright (API + web must be up)
pnpm --filter @aptora/e2e test
```

## Explicitly out of Phase 1

- Hosted ERP connectors / payment gateway
- Mobile client
- SSO/SAML/OIDC (hooks only)
- Parallel approvals / BPMN designer

See [PHASE2_MODULES.md](./PHASE2_MODULES.md) for the next commercial modules.
