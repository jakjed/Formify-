# Data residency (US / EU)

Phase 1 pins each **tenant** to a residency region at create time (`Tenant.region`: `us` | `eu`).

## Product rules

| Rule | Behavior |
|---|---|
| Pin at signup | `POST /api/tenants` accepts `region` (default `us`) |
| Immutable for GA | Changing region requires ops migration (not self-serve in Phase 1) |
| Storage | Local/dev: `STORAGE_PATH` on the API host. Staging/prod: place object storage + Postgres in the tenant’s region (see [HOSTING.md](./HOSTING.md)) |
| OCR | Prefer Textract in the same AWS region as the tenant pin (`AWS_REGION`) |
| No dual-write | Phase 1 does not replicate invoice payloads across regions |

## Testable checks

1. Create tenant with `region: "eu"` → `GET /api/tenants/:id` returns `region: "eu"`.
2. Create tenant with `region: "us"` → same for `us`.
3. Isolation test (`tenancy.isolation.spec.ts`) proves tenant-scoped invoice reads never cross tenants (region-agnostic but required for residency trust).

## Ops evidence (SOC2-friendly)

- Audit log records auth, admin, and invoice mutations (`AuditEvent`)
- API keys hashed at rest; invite/reset tokens hashed
- Rate limits per principal (`RATE_LIMIT_*` env)
- No payment gateway or ERP connector code paths in Phase 1
