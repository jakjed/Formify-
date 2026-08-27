# E1 — Master data & auth guard

## Added

- Global **Bearer session AuthGuard** (`@Public()` for health, tenant create, login/register)
- `GET /api/auth/me`
- Master data CRUD (tenant-scoped):
  - `/api/vendors`
  - `/api/gl-accounts`
  - `/api/cost-centers`
  - `/api/tax-codes`
  - `/api/payment-terms`
- Web: `/bootstrap`, `/directory`, auth-gated shell

## Migrate

```bash
pnpm db:up
pnpm --filter @aptora/api prisma:migrate
# or
pnpm db:deploy
```
