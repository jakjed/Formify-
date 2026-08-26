# Monorepo & modularity rules

## Why this shape

Aptora is sold as **independently enableable modules** (Invoices now; Contracts / PR / PO later) on a **shared Platform Core**.  
Phase 1 ships a **modular monolith** (one API process, clear module boundaries). Extract capture workers or connectors later without renaming folders.

```text
apps/
  api/                 NestJS modular monolith
  web/                 React feature modules
  mobile/              Expo (after web GA)
packages/
  types/               Shared domain contracts (TS)
  ui/                  Design tokens + primitives (Ledger Light)
  api-client/          OpenAPI-generated client
  config-typescript/
  config-eslint/
docs/
tooling/
```

## Backend modules (`apps/api/src/modules`)

| Module | Responsibility | Phase |
|---|---|---|
| `tenancy` | Tenant, entity, isolation helpers, module licenses / flags | 0 |
| `identity` | Users, password auth, roles, permissions, AuthProviderConfig | 0 |
| `masterdata` | Vendors, GL, cost centers, tax, terms | 1 |
| `invoices` | Invoice aggregate, lines, exceptions, states | 1 |
| `capture` | Upload/email ingest, Textract pipeline, file assets | 1 |
| `workflow` | Approval policies, tasks, delegation, escalation | 1 |
| `integration` | Integration Center templates, import/export jobs | 1 |
| `usage` | `invoice.approved` billable events, OCR page meters | 1 |
| `audit` | Append-only audit log | 0 |
| `notifications` | In-app + email notifications | 1 |

**Later (Phase 2) — add folders, do not overload invoices:**

- `contracts`
- `purchase-requests`
- `purchase-orders`

### Module folder convention (API)

```text
modules/<name>/
  <name>.module.ts
  application/          # use cases / services
  domain/               # entities, enums, invariants
  infrastructure/       # persistence, external adapters
  api/                  # Nest controllers / DTOs
  index.ts              # public exports only
  README.md
```

**Rules**

1. Depend **inward**: `api` → `application` → `domain`; infrastructure implements ports.
2. Cross-module calls go through **public application APIs** or domain events — no reaching into another module’s `infrastructure`.
3. Soft-links (e.g. invoice ↔ PO later) are optional interfaces; never hard-require a disabled module.
4. Each Nest `*.module.ts` is independently importable into `AppModule` behind a license check where needed.

## Frontend modules (`apps/web/src/modules`)

| Folder | Maps to |
|---|---|
| `auth` | identity |
| `my-work` | workflow tasks + assigned exceptions |
| `invoices` | invoices + capture UX entry points |
| `directory` | masterdata |
| `integration-center` | integration |
| `admin` | tenancy, identity admin, usage, audit, capture settings |

Shared chrome lives in `src/app` + `src/shared`. Feature UI must not import from another feature’s internals — use `packages/types` and `packages/api-client`.

## Shared packages

| Package | Use |
|---|---|
| `@aptora/types` | IDs, money, invoice states, events (`invoice.approved`) |
| `@aptora/ui` | tokens + primitives shared with future mobile |
| `@aptora/api-client` | typed HTTP SDK |
| `@aptora/config-*` | ESLint / TSConfig baselines |

## Deployables vs modules

| Deployable | Contains |
|---|---|
| `apps/api` | All backend modules (flags gate behavior) |
| `apps/web` | All licensed UI modules (nav hides disabled) |
| workers (future) | May split `capture` / export from API process — keep code under same module folders |

## Phase 1 enablement map

```text
Platform (always): tenancy, identity, audit, notifications, usage hooks
Paid module:       invoices + capture + workflow (invoice approvals) + integration (templates)
```
