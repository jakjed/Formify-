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
- [docs/architecture/MONOREPO.md](docs/architecture/MONOREPO.md) — folder & module rules
- [docs/architecture/E0_FOUNDATION.md](docs/architecture/E0_FOUNDATION.md) — run the foundation locally
- [docs/architecture/HOSTING.md](docs/architecture/HOSTING.md) — where to host & what to do first
- [docs/architecture/E1_MASTERDATA.md](docs/architecture/E1_MASTERDATA.md) — auth guard + directory master data
- [docs/architecture/E2_CAPTURE.md](docs/architecture/E2_CAPTURE.md) — capture upload + invoice workspace
- [docs/architecture/E3_WORKFLOW_EXPORT.md](docs/architecture/E3_WORKFLOW_EXPORT.md) — approvals + Integration Center export

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
