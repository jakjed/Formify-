# Aptora monorepo

Modular Accounts Payable / Procure-to-Pay suite (invoices first; contracts, PR, and PO next) — cloud web first, React Native mobile second.

Formerly working name: Formify.

| Layer | Path | Role |
|---|---|---|
| API | [`apps/api`](apps/api) | NestJS **modular monolith** — domain modules behind one deployable |
| Web | [`apps/web`](apps/web) | React (Vite) — module-aligned UI feature folders |
| Mobile | [`apps/mobile`](apps/mobile) | React Native (Expo) — placeholder until after web GA |
| Shared packages | [`packages/*`](packages) | Types, UI kit, API client, tool configs |
| Docs | [`docs`](docs) | Product + architecture |
| Tooling | [`tooling`](tooling) | Scripts (codegen, templates, ops helpers) |

## Docs

- **[docs/PRODUCT_BLUEPRINT.md](docs/PRODUCT_BLUEPRINT.md)** — full product, UX, architecture, hosting, packaging, roadmap
- **[docs/PHASE1_PRD.md](docs/PHASE1_PRD.md)** — Phase 1 PRD + screen inventory (Aptora AP web wedge)
- **[docs/PHASE2_PRD.md](docs/PHASE2_PRD.md)** — Phase 2 Procure (Contracts + PR + PO)
- **[docs/PHASE3_PRD.md](docs/PHASE3_PRD.md)** — Phase 3 Ecosystem (webhooks, connectors, SSO…)
- [docs/architecture/MONOREPO.md](docs/architecture/MONOREPO.md) — folder & module rules
- [docs/architecture/E0_FOUNDATION.md](docs/architecture/E0_FOUNDATION.md) — run the foundation locally
- [docs/architecture/HOSTING.md](docs/architecture/HOSTING.md) — where to host & what to do first
- [docs/architecture/E1_MASTERDATA.md](docs/architecture/E1_MASTERDATA.md) — auth guard + directory master data
- [docs/architecture/E2_CAPTURE.md](docs/architecture/E2_CAPTURE.md) — capture upload + invoice workspace
- [docs/architecture/E3_WORKFLOW_EXPORT.md](docs/architecture/E3_WORKFLOW_EXPORT.md) — approvals + Integration Center export
- [docs/architecture/E4_IMPORT_TEXTRACT.md](docs/architecture/E4_IMPORT_TEXTRACT.md) — CSV import + optional Textract
- [docs/architecture/E5_EMAIL_NOTIFY_AUDIT.md](docs/architecture/E5_EMAIL_NOTIFY_AUDIT.md) — email capture, notifications, audit
- [docs/architecture/E6_ADMIN_APIKEYS_USAGE.md](docs/architecture/E6_ADMIN_APIKEYS_USAGE.md) — admin users, API keys, usage
- [docs/architecture/E7_WORKLIST_DASHBOARD.md](docs/architecture/E7_WORKLIST_DASHBOARD.md) — worklist, exceptions, ops
- [docs/architecture/E8_DUP_VALIDATION.md](docs/architecture/E8_DUP_VALIDATION.md) — duplicate detection + validation
- [docs/architecture/E9_COMMENTS_ACTIVITY.md](docs/architecture/E9_COMMENTS_ACTIVITY.md) — comments + activity timeline
- [docs/architecture/E10_INVITE_RESET.md](docs/architecture/E10_INVITE_RESET.md) — invites, password reset, lockout
- [docs/architecture/E11_OPENAPI.md](docs/architecture/E11_OPENAPI.md) — OpenAPI 3 + Swagger UI
- [docs/architecture/E12_HARDENING.md](docs/architecture/E12_HARDENING.md) — rate limits, residency, CSV export, search
- [docs/architecture/RESIDENCY.md](docs/architecture/RESIDENCY.md) — US/EU data residency pin
- [docs/architecture/E13_PHASE1_E2E.md](docs/architecture/E13_PHASE1_E2E.md) — J1–J3 journeys & Playwright
- [docs/architecture/PHASE1_COMPLETE.md](docs/architecture/PHASE1_COMPLETE.md) — Phase 1 track complete
- [docs/architecture/P2_E0_PROCURE_FOUNDATION.md](docs/architecture/P2_E0_PROCURE_FOUNDATION.md) — Phase 2 procure foundation
- [docs/architecture/P2_E1_CONTRACTS_WORKSPACE.md](docs/architecture/P2_E1_CONTRACTS_WORKSPACE.md) — Contracts workspace (amend/renew/comments)
- [docs/architecture/P2_E2_PR_TO_PO.md](docs/architecture/P2_E2_PR_TO_PO.md) — PR → PO convert
- [docs/architecture/P2_E3_RECEIVING.md](docs/architecture/P2_E3_RECEIVING.md) — PO receiving (partial/full)
- [docs/architecture/P2_E4_INVOICE_MATCH.md](docs/architecture/P2_E4_INVOICE_MATCH.md) — Invoice 2/3-way PO match
- [docs/architecture/P2_E5_INTEGRATION.md](docs/architecture/P2_E5_INTEGRATION.md) — Procure Integration templates/exports
- [docs/architecture/PHASE2_COMPLETE.md](docs/architecture/PHASE2_COMPLETE.md) — Phase 2 Procure track complete
- [docs/architecture/P3_E0_ECOSYSTEM_FOUNDATION.md](docs/architecture/P3_E0_ECOSYSTEM_FOUNDATION.md) — Phase 3 webhooks + connector registry
- [docs/architecture/P3_E1_SSO_OIDC.md](docs/architecture/P3_E1_SSO_OIDC.md) — SSO OIDC (mock + live)
- [docs/architecture/PHASE3_MODULES.md](docs/architecture/PHASE3_MODULES.md) — Phase 3 ecosystem surfaces

## Workspace

```bash
pnpm db:up          # Postgres via Docker Compose
pnpm install
pnpm --filter @aptora/types build
pnpm db:deploy      # apply Prisma migrations
pnpm dev            # API :3001 + web :5173
pnpm build
```

Requires Node 22+, pnpm 9+, and PostgreSQL 16 (Docker or local).

## Module enablement

Backend and frontend keep the same bounded contexts. Runtime enablement is via `ModuleLicense` / feature flags (Platform Core), not separate deploys in Phase 1.
