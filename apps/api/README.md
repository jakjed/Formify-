# `@aptora/api`

NestJS modular monolith. Domain code lives in `src/modules/*`. Persistence via **Prisma + PostgreSQL**.

## Commands

```bash
pnpm db:up                                 # from repo root — Docker Postgres
pnpm --filter @aptora/api prisma:generate
pnpm --filter @aptora/api prisma:deploy    # apply migrations
pnpm --filter @aptora/api dev              # watch mode
pnpm --filter @aptora/api build
pnpm --filter @aptora/api start
```

## Layout

```text
src/
  modules/     bounded contexts (tenancy, identity, invoices, …)
  health/      liveness (+ DB check)
  database/    Prisma client module
  common/      cross-cutting utilities
prisma/        schema + migrations
```

See [E0_FOUNDATION.md](../../docs/architecture/E0_FOUNDATION.md).
