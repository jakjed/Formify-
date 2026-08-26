# E0 Foundation

Bootstrap of the Aptora modular monolith + web shell.

## Run locally

```bash
pnpm install
pnpm --filter @aptora/types build
pnpm dev
```

- Web: http://localhost:5173  
- API: http://localhost:3001/api/health  

## Smoke bootstrap (tenant + user)

```bash
# Create tenant
curl -s -X POST http://localhost:3001/api/tenants \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","slug":"acme","region":"eu"}'

# Register admin (use tenant id from previous response)
curl -s -X POST http://localhost:3001/api/auth/register \
  -H 'content-type: application/json' \
  -d '{"tenantId":"<TENANT_ID>","email":"admin@acme.test","displayName":"Admin","password":"password1"}'

# Login
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"tenantId":"<TENANT_ID>","email":"admin@acme.test","password":"password1"}'
```

## Notes

- Persistence is **in-memory** for E0 (replaced by Postgres in a following epic).
- Password hashing is a temporary SHA-256 placeholder — switch to argon2/bcrypt before any real deployment.
- Auth providers are configurable (`local` on; `oidc`/`saml` stubs off).
