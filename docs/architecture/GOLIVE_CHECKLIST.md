# Plan releasowania produkcyjnego (go-live)

Checklist operacyjny dla pierwszego wdrożenia Procure Ledger na produkcję — **EU-first**, AWS, B2B SaaS. Uzupełnia [HOSTING.md](./HOSTING.md), [RESIDENCY.md](./RESIDENCY.md) i [AI_DATA_POLICY.md](./AI_DATA_POLICY.md).

**Cel:** jeden region produkcyjny (`eu-west-1`), staging na Railway, pierwszy płacący klient bez ręcznego deployu na serwerze.

**Domena produktu:** `procureledger.com` · kontakt operacyjny: `jakub.jedrej@procureledger.com`

---

## Podsumowanie faz

| Faza | Co | Wynik |
| --- | --- | --- |
| 0 | Prawo + handlowo | ToS, Privacy, DPA, subprocesorzy |
| 1 | Domena + DNS | `app.`, `api.`, `staging.` |
| 2 | Staging (Railway) | URL dla QA i design partnerów |
| 3 | AWS prod (EU) | S3, CloudFront, Fargate, RDS, Textract |
| 4 | Sekrety + env | staging ≠ prod, rotacja kluczy |
| 5 | CI/CD | main → build → staging → prod |
| 6 | Bezpieczeństwo | backup, monitoring, WAF (opcjonalnie) |
| 7 | Onboarding klienta | tenant EU, SSO opcjonalnie, szkolenie |

---

## Faza 0 — Prawo i handlowo (równolegle z infra)

Zanim pierwszy klient podpisze umowę:

| Dokument | Zawartość minimalna | Właściciel |
| --- | --- | --- |
| **Regulamin (ToS)** | SLA, limity użycia, odpowiedzialność, wypowiedzenie | Prawnik / PM |
| **Polityka prywatności** | RODO, cele przetwarzania, prawa użytkownika | Prawnik |
| **DPA (umowa powierzenia)** | Rola: Procure Ledger = processor, klient = controller; subprocessors | Prawnik |
| **Lista subprocesorów** | AWS (hosting, RDS, S3, Textract, opcjonalnie Bedrock), e-mail (np. SES/Resend) | PM + DevOps |
| **Order form / załącznik techniczny** | Region danych (`eu`), OCR on/off, AI assist off (domyślnie) | PM |
| **Incident response** | Kto, w jakim czasie, powiadomienie klienta (RODO 72h) | PM + DevOps |

**Checklist:**

- [ ] DPA zgodne z RODO (EU klient = wymagane)
- [ ] Subprocesorzy: AWS w `eu-west-1` — opisane w DPA
- [ ] Brak treningu modeli na danych klienta — zgodnie z [AI_DATA_POLICY.md](./AI_DATA_POLICY.md)
- [ ] Polityka retencji: faktury, pliki, logi audytu (np. 7 lat faktury — uzgodnić z klientem)

---

## Faza 1 — Domena i DNS

Przykład: domena `procureledger.com` (zastąp własną).

### Rekordy produkcyjne

| Host | Typ | Cel | Uwagi |
| --- | --- | --- | --- |
| `app.procureledger.com` | CNAME | CloudFront distribution (web SPA) | Cert ACM w `us-east-1` dla CloudFront |
| `api.procureledger.com` | CNAME / ALIAS | ALB lub CloudFront → API | HTTPS obowiązkowy |
| `staging.procureledger.com` | CNAME | Railway / Render (web) | Osobny cert |
| `staging-api.procureledger.com` | CNAME | Railway API service | |

### SSO (gdy klient wymaga enterprise login)

| Callback | URL |
| --- | --- |
| OIDC redirect | `https://api.procureledger.com/api/auth/oidc/callback` |
| SAML ACS | `https://api.procureledger.com/api/auth/saml/acs` |
| SAML metadata | `https://api.procureledger.com/api/auth/saml/metadata?tenantId={uuid}` |

Te same ścieżki na staging z prefiksem `staging-api.`.

### Checklist DNS

- [ ] Domena zarejestrowana, DNS w Route 53 lub u registrara z delegacją
- [ ] Certyfikaty TLS (ACM) — auto-renew
- [ ] `WEB_ORIGIN` i `API_PUBLIC_URL` zgodne z finalnymi URL (bez trailing slash)
- [ ] CORS: tylko `app.*` → `api.*`

---

## Faza 2 — Staging (Railway / Render)

**Cel:** szybki URL dla demo i QA **bez** pełnego stacku AWS.

### Minimalny stack staging

| Komponent | Usługa |
| --- | --- |
| Postgres | Railway Postgres plugin |
| API | Docker / Nixpacks — `apps/api` |
| Web | Static build `apps/web` → Railway static lub Vercel |
| Pliki | Volume tymczasowy **lub** jeden bucket S3 `aptora-staging-eu` |
| OCR | `OCR_PROVIDER=stub` (domyślnie) lub Textract z tym samym `AWS_REGION` |

### Deploy staging (ręcznie pierwszy raz)

```bash
# Build (z root monorepo)
pnpm install
pnpm --filter @aptora/types build
pnpm --filter @aptora/api build
pnpm --filter @aptora/web build

# Migracje (jednorazowo + przy każdym release)
pnpm db:deploy
```

### Env staging (przykład)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...railway...
PORT=3001
WEB_ORIGIN=https://staging.procureledger.com
API_PUBLIC_URL=https://staging-api.procureledger.com
STORAGE_PATH=/data/uploads
OCR_PROVIDER=stub
AWS_REGION=eu-west-1
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
# SESSION_SECRET / JWT — z generatora, inny niż prod
```

### Checklist staging

- [ ] `pnpm db:deploy` na staging DB
- [ ] Seed / ręczne utworzenie tenant demo (`region: eu`)
- [ ] Login admin + smoke: faktura, approval, export CSV
- [ ] Staging **nie** zawiera danych produkcyjnych klientów
- [ ] Backup DB staging opcjonalny (nie krytyczny)

---

## Faza 3 — AWS produkcja (EU)

**Region domyślny:** `eu-west-1` (Irlandia). Pin tenantów EU zgodnie z [RESIDENCY.md](./RESIDENCY.md).

### Zasoby AWS (checklist)

| # | Zasób | Nazwa / konfiguracja | Uwagi |
| --- | --- | --- | --- |
| 1 | **VPC** | `aptora-prod-eu` | 2 AZ, public + private subnets |
| 2 | **RDS PostgreSQL** | `aptora-prod-db` | Multi-AZ gdy SLA wymaga; min `db.t4g.small` na start |
| 3 | **S3 — web** | `aptora-prod-web-eu` | Static SPA, block public access, OAI/OAC → CloudFront |
| 4 | **S3 — documents** | `aptora-prod-files-eu` | SSE-S3, lifecycle (np. IA po 90 dniach) |
| 5 | **CloudFront — web** | `app.procureledger.com` | Origin: S3 web bucket |
| 6 | **CloudFront / ALB — API** | `api.procureledger.com` | Origin: ALB → ECS |
| 7 | **ECS Fargate** | Cluster `aptora-prod`, service `api` | 2 tasks min dla HA |
| 8 | **ECR** | Repo `aptora/api` | Obraz z CI |
| 9 | **Secrets Manager** | `aptora/prod/api` | DB URL, session secret, opcjonalnie AWS keys |
| 10 | **IAM** | Role dla ECS task | S3 read/write, Textract, Secrets Manager |
| 11 | **SQS** (opcjonalnie) | Kolejka OCR jobs | Gdy OCR async / worker osobny task |
| 12 | **Textract** | Włączone w regionie | `OCR_PROVIDER=textract` |
| 13 | **CloudWatch** | Log groups + alarms | 5xx, CPU, RDS connections |
| 14 | **WAF** (opcjonalnie) | Na CloudFront | Rate limit, geo block jeśli potrzeba |

### Architektura (prod)

```text
Browser → CloudFront (app) → S3 (SPA)
       → CloudFront/ALB (api) → ECS Fargate (API)
API → RDS PostgreSQL (private subnet)
API → S3 (documents)
API → Textract (sync lub SQS → worker)
```

### RDS — parametry startowe

- Engine: PostgreSQL 15+
- Storage: 20–50 GB gp3, autoscaling włączone
- Backup retention: 7–30 dni (zależnie od SLA)
- `publicly_accessible = false`
- Security group: tylko z ECS tasks

### Checklist AWS prod

- [ ] Wszystkie zasoby w `eu-west-1` dla pool EU
- [ ] RDS snapshot przed pierwszym klientem produkcyjnym
- [ ] S3 bucket policy — brak public read na files
- [ ] ECS health check: `GET /api/health` (lub istniejący endpoint)
- [ ] Auto-scaling policy (CPU > 70% → +1 task)
- [ ] Koszt alert: AWS Budgets (np. 500 EUR/mies. na start)

---

## Faza 4 — Zmienne środowiskowe (prod)

Pełna lista w `apps/api/.env.example`. **Prod vs staging — inne sekrety zawsze.**

### Prod (EU) — wymagane

```env
NODE_ENV=production
DATABASE_URL=postgresql://...@aptora-prod-db....eu-west-1.rds.amazonaws.com:5432/aptora
PORT=3001
WEB_ORIGIN=https://app.procureledger.com
API_PUBLIC_URL=https://api.procureledger.com
STORAGE_PATH=s3://aptora-prod-files-eu/uploads
OCR_PROVIDER=textract
AWS_REGION=eu-west-1
# AWS credentials via ECS task role (preferowane) lub:
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
SESSION_SECRET=<64+ random bytes>
```

### Web (build-time)

```env
VITE_API_URL=https://api.procureledger.com
```

### Checklist env

- [ ] Żaden sekret w git / obrazie Docker — tylko Secrets Manager / Railway vars
- [ ] `WEB_ORIGIN` = dokładnie origin SPA (scheme + host, bez path)
- [ ] OIDC/SAML redirect URI zgodne z `API_PUBLIC_URL`
- [ ] Rotacja `SESSION_SECRET` = wylogowanie wszystkich sesji — zaplanować okno maintenance

---

## Faza 5 — CI/CD

**Zasada:** `main` → build → deploy staging → (manual approve) → deploy prod.

### GitHub Actions (szkielet do dodania w repo)

```yaml
# .github/workflows/deploy.yml (propozycja)
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @aptora/types build
      - run: pnpm --filter @aptora/api build
      - run: pnpm --filter @aptora/web build
      - run: pnpm test --if-present
      # docker build + push ECR
      # deploy staging (Railway CLI / AWS)
  deploy-prod:
    needs: build
    if: github.event_name == 'workflow_dispatch' # ręczna aprobata
    environment: production
    steps:
      - run: aws ecs update-service --cluster aptora-prod --service api --force-new-deployment
      - run: aws s3 sync apps/web/dist s3://aptora-prod-web-eu --delete
      - run: aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

### Migracje DB przy release

```bash
# W jobie deploy PRZED przełączeniem ruchu na nową wersję API
pnpm db:deploy
```

### Checklist CI/CD

- [ ] Workflow na `main` — build + test
- [ ] Obraz API tagowany semver lub git SHA
- [ ] Deploy prod wymaga approval (GitHub Environment)
- [ ] Rollback: poprzedni tag ECS + ewentualnie revert migracji (ostrożnie)
- [ ] Po deploy: smoke test (login, lista faktur, health)

---

## Faza 6 — Bezpieczeństwo i operacje

| Obszar | Wymaganie | Dowód |
| --- | --- | --- |
| TLS | Wszędzie HTTPS | ACM certs |
| DB | Private subnet, brak public IP | RDS config |
| Sekrety | Secrets Manager | Audyt IAM |
| Backup | RDS automated + test restore 1× | Ticket ops |
| Logi | CloudWatch, retencja 90 dni | Log group policy |
| Audyt aplikacji | `AuditEvent` w DB | E5 docs |
| Rate limit | `RATE_LIMIT_*` | E12 |
| Tenant isolation | Test Jest + manual QA | `tenancy.isolation.spec.ts` |
| GDPR | DPA + subprocessors | Faza 0 |
| AI / OCR | [AI_DATA_POLICY.md](./AI_DATA_POLICY.md) | Admin toggle AI off |

### RPO / RTO (propozycja na start)

| Metryka | Cel |
| --- | --- |
| RPO | ≤ 1 h (RDS backup + PITR) |
| RTO | ≤ 4 h (restore + redeploy) |

### Monitoring — alerty minimum

- [ ] API 5xx rate > 1% przez 5 min
- [ ] RDS CPU > 80% przez 15 min
- [ ] RDS free storage < 20%
- [ ] ECS task unhealthy

---

## Faza 7 — Onboarding pierwszego klienta

### Przed go-live klienta

1. **Tenant** — `POST /api/tenants` z `region: "eu"`, nazwa organizacji
2. **Admin** — invite / create user, rola admin
3. **Entity / RBAC** — encje, role, approval rules (jeśli multi-entity)
4. **Master data** — vendors, GL codes, cost centers (import CSV jeśli jest)
5. **OCR** — `OCR_PROVIDER=textract` + limit stron w umowie
6. **AI assist** — domyślnie **Off** ([AI_DATA_POLICY.md](./AI_DATA_POLICY.md))
7. **SSO** (opcjonalnie) — OIDC lub SAML; metadata dla IdP klienta
8. **Mailbox** (opcjonalnie) — inbound e-mail capture per [MAILBOXES.md](./MAILBOXES.md)

### Smoke test go-live (30 min)

| # | Scenariusz | Oczekiwany wynik |
| --- | --- | --- |
| 1 | Login admin | 200, dashboard |
| 2 | Upload faktury PDF | OCR fields lub HITL |
| 3 | Approval workflow | Status approved |
| 4 | Export CSV | Pobranie pliku |
| 5 | Drugi użytkownik, inna rola | RBAC 403 tam gdzie brak uprawnień |
| 6 | Audit log | Zdarzenia widoczne dla admina |

### Po go-live

- [ ] Kanał wsparcia (e-mail / Slack shared)
- [ ] Cotygodniowy review błędów CloudWatch
- [ ] Miesięczny review kosztów Textract vs faktury zatwierdzone

---

## Harmonogram (orientacyjny)

| Tydzień | Działania |
| --- | --- |
| **T1** | Domena, AWS org/account, Railway staging, env staging, smoke lokalny → staging |
| **T2** | VPC + RDS + S3 + ECR; pierwszy deploy API na ECS (bez ruchu klienta) |
| **T3** | CloudFront + DNS prod; CI/CD skeleton; backup test |
| **T4** | Dokumenty prawne (ToS, DPA); pen test light / checklist OWASP |
| **T5** | Design partner na staging; poprawki |
| **T6** | Go-live klient #1 na prod EU; hypercare 2 tygodnie |

Harmonogram zależy od dostępności prawnika, AWS approval w firmie klienta (SSO) i zakresu importu master data.

---

## Szacunek kosztów (start, EU, ~5 użytkowników, niski wolumen)

| Pozycja | Miesięcznie (orientacyjnie) |
| --- | --- |
| Railway staging | 20–50 USD |
| RDS `db.t4g.small` Multi-AZ | 80–150 USD |
| ECS Fargate 2× 0.5 vCPU | 40–80 USD |
| S3 + CloudFront | 10–30 USD |
| Textract (1000 stron) | ~15 USD variable |
| Route 53 + ACM | 1–5 USD |
| Secrets Manager | < 5 USD |
| **Razem fixed** | **~150–320 USD/mies.** + OCR per strona |

Skaluj RDS i Fargate po pierwszych metrykach (CPU, latency, wolumen faktur).

---

## Go / No-Go (decyzja przed prod)

Wszystkie **MUST** przed pierwszym klientem z danymi finansowymi:

- [ ] Staging przeszedł pełny smoke (Faza 7)
- [ ] Prod RDS + backup restore przetestowany
- [ ] DPA podpisane
- [ ] `SESSION_SECRET` i DB credentials tylko w Secrets Manager
- [ ] `region: eu` na tenantach EU
- [ ] Textract w `eu-west-1` (nie cross-region)
- [ ] Brak danych testowych na prod DB
- [ ] Runbook incydentu (kontakt, eskalacja, komunikat klienta)
- [ ] Rollback plan udokumentowany

**SHOULD** (można zaraz po go-live):

- [ ] WAF na CloudFront
- [ ] SQS worker dla OCR async
- [ ] SSO live (nie mock) dla klienta enterprise
- [ ] SOC 2 Type I roadmap

---

## Runbook — szybkie komendy

```bash
# Migracje (staging/prod — z maszyny CI lub bastion)
DATABASE_URL="..." pnpm db:deploy

# Wymuszenie redeploy API (ECS)
aws ecs update-service --cluster aptora-prod --service api --force-new-deployment --region eu-west-1

# Inwalidacja cache SPA
aws cloudfront create-invalidation --distribution-id DISTRIBUTION_ID --paths "/*"

# Snapshot RDS przed dużą migracją
aws rds create-db-snapshot --db-instance-identifier aptora-prod-db --db-snapshot-identifier pre-release-$(date +%Y%m%d)
```

---

## Powiązane dokumenty

- [HOSTING.md](./HOSTING.md) — architektura i fazy hostingu
- [RESIDENCY.md](./RESIDENCY.md) — pin regionu tenantów US/EU
- [AI_DATA_POLICY.md](./AI_DATA_POLICY.md) — OCR, LLM, DPA talking points
- [E12_HARDENING.md](./E12_HARDENING.md) — rate limit, izolacja
- [P3_E1_SSO_OIDC.md](./P3_E1_SSO_OIDC.md) — callback URL dla SSO
- [MAILBOXES.md](./MAILBOXES.md) — skrzynki inbound/outbound
- [E5_EMAIL_NOTIFY_AUDIT.md](./E5_EMAIL_NOTIFY_AUDIT.md) — powiadomienia i audyt

---

*Ostatnia aktualizacja: 2026-08-27 — Procure Ledger Phase 1/2 go-live.*
