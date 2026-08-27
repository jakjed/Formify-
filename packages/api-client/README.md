# `@aptora/api-client`

OpenAPI-backed client package for `apps/web` (and later `apps/mobile`).

## Spec

- Live Swagger UI: `http://localhost:3001/api/docs`
- Live JSON: `http://localhost:3001/api/docs-json`
- Checked-in snapshot: [`openapi.json`](./openapi.json) (refreshed when the API boots)

## Generate / refresh

```bash
# start API once — writes packages/api-client/openapi.json
pnpm --filter @aptora/api start

# or:
curl -s http://localhost:3001/api/docs-json | tee packages/api-client/openapi.json
```

Typed SDK generation (openapi-typescript / openapi-generator) can be wired later; Phase 1 ships the OpenAPI 3 document itself (PRD A-01).
