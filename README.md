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

## Workspace

```bash
pnpm install
pnpm dev          # turbo: api + web
pnpm build
pnpm lint
pnpm test
```

Requires Node 22+ and pnpm 9+.

## Module enablement

Backend and frontend keep the same bounded contexts. Runtime enablement is via `ModuleLicense` / feature flags (Platform Core), not separate deploys in Phase 1.
