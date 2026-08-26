# `@aptora/api`

NestJS modular monolith. Domain code lives in `src/modules/*`.

## Commands

```bash
pnpm --filter @aptora/api dev     # watch mode
pnpm --filter @aptora/api build
pnpm --filter @aptora/api start
```

## Layout

```text
src/
  modules/     bounded contexts (tenancy, identity, invoices, …)
  health/      liveness
  common/      cross-cutting utilities
  config/      env notes
  database/    ORM host (Postgres next)
```

E0 uses **in-memory** stores for tenancy/identity. See [E0_FOUNDATION.md](../../docs/architecture/E0_FOUNDATION.md).
