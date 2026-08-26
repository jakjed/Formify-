# Cross-cutting (`common`, `config`, `database`)

- `common` — guards, pipes, interceptors used by multiple modules (no domain logic)
- `config` — environment loading
- `database` — ORM DataSource, migrations runner (entities stay owned by modules)
