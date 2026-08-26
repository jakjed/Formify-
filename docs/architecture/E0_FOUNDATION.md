# E0 Foundation

Bootstrap of the Aptora modular monolith + web shell + **PostgreSQL persistence** for tenancy/identity.

## Prerequisites

- Node 22+
- pnpm 9+
- PostgreSQL 16 (Docker Compose **or** local install)

## Run locally

```bash
# 1) Start Postgres (preferred on a normal machine)
pnpm db:up

# 2) Install & migrate
pnpm install
cp apps/api/.env.example apps/api/.env   # if needed
pnpm --filter @aptora/types build
pnpm db:deploy    # or: pnpm db:migrate  (dev, creates migrations)

# 3) API + web
pnpm dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001/api/health → should show `"database":"up"`

### Without Docker

Create DB/user matching `DATABASE_URL` in `apps/api/.env`:

```text
postgresql://aptora:aptora@localhost:5432/aptora?schema=public
```

For `prisma migrate dev`, the DB user needs permission to create a shadow database (`CREATEDB`), or use `pnpm db:deploy` with committed migrations.

## Smoke bootstrap (tenant + user)

```bash
curl -s -X POST http://localhost:3001/api/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","slug":"acme","region":"eu"}'

curl -s -X POST http://localhost:3001/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"tenantId":"<TENANT_ID>","email":"admin@acme.test","displayName":"Admin","password":"password1"}'

curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"tenantId":"<TENANT_ID>","email":"admin@acme.test","password":"password1"}'
```

Data survives API restarts (Postgres).

## What’s persisted (E0)

| Area | Storage |
|---|---|
| Tenants, entities, module licenses | Postgres |
| Users, sessions, auth provider configs | Postgres |
| Passwords | **argon2** hashes |
| Other Phase 1 modules | Still scaffold / in-memory later |

## Next

- E1 master data (vendors, GL) on Postgres  
- Auth guard on protected routes using session token  
- Continue Phase 1 invoice capture on this foundation  
