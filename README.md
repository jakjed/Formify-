# Aptora monorepo

Modular Accounts Payable / Procure-to-Pay suite.

| Layer | Path | Role |
|---|---|---|
| API | [`apps/api`](apps/api) | NestJS **modular monolith** — domain modules behind one deployable |
| Web | [`apps/web`](apps/web) | React (Vite) — module-aligned UI feature folders |
| Mobile | [`apps/mobile`](apps/mobile) | React Native (Expo) — placeholder until after web GA |
| Shared packages | [`packages/*`](packages) | Types, UI kit, API client, tool configs |
| Docs | [`docs`](docs) | Product + architecture |
| Tooling | [`tooling`](tooling) | Scripts (codegen, templates, ops helpers) |

## Docs

- [docs/PRODUCT_BLUEPRINT.md](docs/PRODUCT_BLUEPRINT.md) — product blueprint
- [docs/PHASE1_PRD.md](docs/PHASE1_PRD.md) — Phase 1 PRD (when merged)
- [docs/architecture/MONOREPO.md](docs/architecture/MONOREPO.md) — folder & module rules
- [docs/architecture/E0_FOUNDATION.md](docs/architecture/E0_FOUNDATION.md) — run the foundation locally

## Workspace

```bash
pnpm install
pnpm --filter @aptora/types build
pnpm dev          # API :3001 + web :5173
pnpm build
pnpm lint
pnpm test
```

Requires Node 22+ and pnpm 9+.

## Module enablement

Backend and frontend keep the same bounded contexts. Runtime enablement is via `ModuleLicense` / feature flags (Platform Core), not separate deploys in Phase 1.
