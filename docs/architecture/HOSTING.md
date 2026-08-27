# Aptora hosting guide

**Primary production target:** AWS (multi-tenant SaaS)  
**Early demo option:** Railway / Render / Fly.io for API + Postgres, static web on CloudFront or the same platform  
**Locked product choices:** web first, Textract OCR, US + EU data residency, no in-app payments

---

## Where to start (do this order)

Do **not** start with Kubernetes, multi-cloud, or connectors.

### Step 1 — Local product loop (now)

You are here after E0 + Postgres.

1. Run `pnpm db:up && pnpm install && pnpm db:deploy && pnpm --filter @aptora/types build && pnpm dev`
2. Create tenant + admin via API (see [E0_FOUNDATION.md](./E0_FOUNDATION.md))
3. Keep building **Phase 1** on localhost: master data → capture → invoices → approvals → Integration Center

**Goal:** a clerk can approve an invoice locally before any cloud bill matters.

### Step 2 — Postgres (next engineering milestone) — **done in repo**

Replace in-memory tenancy/identity with **PostgreSQL**.

- Local: `docker compose up -d postgres` (`pnpm db:up`)
- Prisma schema + migration: `apps/api/prisma`
- Tenant isolation via `tenant_id` (+ more tests as modules grow)

**Goal:** data survives restart; ready for a shared staging DB.

### Step 3 — First cloud staging (cheap)

Pick **one**:

| Option | Use when |
|---|---|
| **Railway or Render** | Fastest path to a URL for demos |
| **AWS early** | You already have an AWS org / want one less migration |

Minimum staging stack:

- Postgres managed
- API container (`@aptora/api`)
- Web static build (`@aptora/web` → CDN or platform static host)
- Env secrets (JWT/session secret, DB URL)
- One region only for staging (prefer `eu-west-1` if you sell EU first, else `us-east-1`)

**Goal:** `https://staging.…` demo for design partners — still **without** Textract if needed (upload + manual fields OK).

### Step 4 — AWS production shape (sellable)

Move (or start) on **AWS**:

| Piece | Service |
|---|---|
| Web SPA | S3 + CloudFront |
| API | ECS Fargate (or App Runner while tiny) |
| DB | RDS PostgreSQL |
| Files | S3 |
| OCR | Amazon Textract |
| Jobs | SQS + workers (same image or separate task) |
| Secrets | Secrets Manager / SSM |
| Logs/metrics | CloudWatch (+ OpenTelemetry later) |
| Auth edge | HTTPS only; WAF on CloudFront when public |

**Regions**

- Pool A: `us-east-1`
- Pool B: `eu-west-1`
- Pin tenant at signup (`region: us | eu`) — documents and DB stay in pool

**Goal:** SOC2-friendly baseline, Textract metering, EU/US residency story.

### Step 5 — Hardening for paying customers

- Custom domain + TLS
- Automated backups, RPO ≤ 1h, RTO ≤ 4h
- Staging ≠ prod data
- Soft volume limits on `invoice.approved`
- Replace placeholder password hashing with **argon2/bcrypt**
- SSO later (OIDC) when deals require it

### Explicitly later

- EKS / heavy Kubernetes
- ERP connectors
- Mobile app hosting (Expo EAS) — after web GA
- Multi-cloud
- In-app payments

---

## Recommended architectures

### A) Production (default)

```text
Browser → CloudFront (web) → S3
       → CloudFront or ALB → API (Fargate)
API → RDS Postgres
API → S3 (documents)
API → SQS → worker → Textract
```

### B) Demo / pre-AWS

```text
Browser → Railway/Render static or CDN
       → Railway/Render API service
API → managed Postgres on same platform
Files → S3 bucket (even early) OR platform volume (temporary)
OCR → stub / manual until AWS cutover
```

---

## Environments

| Env | Purpose |
|---|---|
| `local` | Dev machines + Docker Postgres |
| `staging` | Design partners, QA, demos |
| `prod` | Paying tenants |

Promote: git main → build images → staging → prod. Never build by hand on servers.

---

## Cost drivers (what to watch)

1. **Textract pages** (largest variable COGS with volume)  
2. S3 storage + egress for PDFs  
3. RDS size / multi-AZ  
4. Fargate CPU/hours  
5. Support time (good exception UX reduces this)

Early fixed cost is usually modest; **per-invoice OCR** dominates as you grow — align pricing (`invoice.approved` + OCR pages) to that.

---

## Security & compliance checklist (hosting-related)

- [ ] TLS everywhere  
- [ ] Secrets not in git  
- [ ] DB not publicly reachable  
- [ ] Tenant region pin enforced  
- [ ] Backups tested once  
- [ ] Access logs for API  
- [ ] GDPR DPA ready when selling EU  
- [ ] Path to SOC 2 (AWS makes evidence easier than random VPS)

---

## What *you* should do this week

1. **Run local stack** with Postgres (`pnpm db:up` → `pnpm db:deploy` → `pnpm dev`).  
2. **Build Phase 1 features** on that foundation (master data → invoices).  
3. Create an **AWS account** (or org) and decide default region (`eu` vs `us`).  
4. Reserve/buy domain for Aptora when trademark/domain is clear.  
5. Only then stand up **staging** (Railway *or* thin AWS).

Hosting follows the product; don’t freeze feature work waiting on perfect infra.

---

## Related docs

- [GOLIVE_CHECKLIST.md](./GOLIVE_CHECKLIST.md) — prod release plan (DNS, AWS, CI/CD, legal, go/no-go)  
- [E0_FOUNDATION.md](./E0_FOUNDATION.md) — run locally  
- [MONOREPO.md](./MONOREPO.md) — module boundaries  
- [PRODUCT_BLUEPRINT.md](../PRODUCT_BLUEPRINT.md) — §8 hosting decisions  
- [PHASE1_PRD.md](../PHASE1_PRD.md) — what to build before scale infra
