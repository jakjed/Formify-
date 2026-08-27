# E11 — OpenAPI 3 for core resources

## Scope

PRD **A-01**: publish OpenAPI 3 for auth session, vendors, invoices, files (capture upload), and integration jobs.

## Surfaces

| URL | Purpose |
|---|---|
| `/api/docs` | Swagger UI |
| `/api/docs-json` | OpenAPI 3 JSON |
| `/api/docs-yaml` | OpenAPI 3 YAML |
| `packages/api-client/openapi.json` | Checked-in snapshot (written on API boot) |

## Auth

Documented as HTTP Bearer (`bearer`):

- Session token from `POST /api/auth/login` or invite accept
- Or API key `aptora_…` (scopes enforced per route)

## Tags

- `auth`, `vendors`, `masterdata`, `invoices`, `capture`, `integration`, `health`

## Notes

- Nest Swagger plugin shims `class-validator` DTOs into schema properties
- Multipart upload/import endpoints declare `binary` file fields
