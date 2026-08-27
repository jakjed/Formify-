# E13 — Phase 1 journeys & E2E

## Scope

Close Phase 1 exit criteria for J1–J3 and permission deny:

1. **API journey suite** — `apps/api/src/journeys/phase1.journey.spec.ts`  
   Run with API up: `RUN_JOURNEY=1 pnpm --filter @aptora/api test -- phase1.journey`
2. **Playwright** — `e2e/tests/phase1.spec.ts`  
   Bootstrap UI + clerk 403 deny: `pnpm --filter @aptora/e2e test`

## Journeys covered

| Journey | Coverage |
|---|---|
| J1 | Tenant + invite clerk + CSV import + upload + submit/approve + export + usage |
| J2 | Implicit via approve/export path + soft auto-approve policy |
| J3 | Comment + activity audit after processing |
| Deny | Clerk cannot `GET /api/users` (403) |
| Isolation | Other tenant cannot read invoice |
