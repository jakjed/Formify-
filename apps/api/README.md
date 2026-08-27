# `@aptora/api`

NestJS modular monolith. Domain code lives in `src/modules/*`.

See [docs/architecture/MONOREPO.md](../../docs/architecture/MONOREPO.md).

```text
src/
  modules/     bounded contexts
  common/      cross-cutting utilities (pipes, guards used by many modules)
  config/      env / app config
  database/    ORM setup, migrations host
```
