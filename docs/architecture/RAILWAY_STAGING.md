# Staging na Railway — Procure Ledger

Instrukcja dla **staging.procureledger.com** (jeden serwis: SPA + API + Postgres).

**Konto:** Railway username `jakjed`  
**Repo:** `jakjed/Formify-` (branch `main`)

---

## Architektura staging

```text
staging.procureledger.com  →  Railway service (Docker)
                                  ├─ NestJS API  /api/*
                                  └─ React SPA   /*
                              PostgreSQL (Railway plugin)
                              Volume         /data/uploads (pliki PDF)
```

---

## Krok 1 — Nowy projekt Railway

1. Zaloguj się: https://railway.com (konto `jakjed`)
2. **New Project** → **Deploy from GitHub repo**
3. Wybierz repo **Formify-** (upewnij się, że GitHub jest połączony z Railway)
4. Branch: **`main`**
5. Railway wykryje `Dockerfile` + `railway.toml` w root

---

## Krok 2 — Dodaj PostgreSQL

1. W projekcie: **+ New** → **Database** → **PostgreSQL**
2. Railway utworzy bazę i zmienną `DATABASE_URL`
3. W serwisie **web/api** (Docker): **Variables** → **Add Reference** → wybierz `DATABASE_URL` z Postgres

---

## Krok 3 — Zmienne środowiskowe (API service)

W **Variables** serwisu Docker ustaw:

| Zmienna | Wartość |
|---------|---------|
| `DATABASE_URL` | Reference → Postgres plugin |
| `NODE_ENV` | `production` |
| `APP_NAME` | `Procure Ledger` |
| `PORT` | `3001` |
| `SERVE_WEB` | `1` |
| `WEB_ORIGIN` | `https://staging.procureledger.com` |
| `API_PUBLIC_URL` | `https://staging.procureledger.com` |
| `STORAGE_PATH` | `/data/uploads` |
| `OCR_PROVIDER` | `stub` |
| `SESSION_SECRET` | *(wygeneruj 64+ losowych znaków)* |
| `ALLOW_PUBLIC_BOOTSTRAP` | `false` |
| `BOOTSTRAP_TOKEN` | *(silny token — do pierwszego workspace)* |
| `RATE_LIMIT_WINDOW_MS` | `60000` |
| `RATE_LIMIT_MAX` | `120` |

Wygeneruj `SESSION_SECRET`:
```bash
openssl rand -hex 32
```

---

## Krok 4 — Volume na pliki (PDF/faktury)

1. Serwis Docker → **Settings** → **Volumes**
2. **Add Volume**
   - Mount path: `/data/uploads`
3. Bez volume pliki znikną po restarcie kontenera.

---

## Krok 5 — Domena własna

1. Serwis Docker → **Settings** → **Networking** → **Custom Domain**
2. Dodaj: `staging.procureledger.com`
3. Railway pokaże rekord DNS (CNAME), np. `xxxx.up.railway.app`
4. U registrara domeny `procureledger.com`:

| Typ | Host | Wartość |
|-----|------|---------|
| CNAME | `staging` | `xxxx.up.railway.app` |

5. Poczekaj na TLS (Railway/Let's Encrypt) — zwykle kilka minut.

> **Tip:** Możesz najpierw użyć domyślnego URL `*.up.railway.app` do smoke testu, potem podpiąć domenę.

---

## Krok 6 — Deploy

1. **Deploy** uruchomi się automatycznie po pushu na `main`
2. Przy starcie kontenera: `pnpm prisma:deploy` → migracje DB
3. Health check: `GET /api/health`

Sprawdź logi: **Deployments** → ostatni deploy → **View logs**  
Szukaj: `Procure Ledger API listening`

---

## Krok 7 — Pierwszy workspace (bootstrap)

Na staging **publiczny bootstrap jest wyłączony** (`ALLOW_PUBLIC_BOOTSTRAP=false`).

### Opcja A — przez UI (gdy bootstrap otwarty tymczasowo)

Ustaw `ALLOW_PUBLIC_BOOTSTRAP=true`, redeploy, wejdź na `/bootstrap`, utwórz workspace, potem z powrotem `false`.

### Opcja B — przez API z tokenem (zalecane)

```bash
curl -X POST https://staging.procureledger.com/api/tenants \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Token: TWOJ_BOOTSTRAP_TOKEN" \
  -d '{"name":"Demo Co","slug":"demo","region":"eu"}'
```

Następnie zarejestruj admina (tenant ID z odpowiedzi):

```bash
curl -X POST https://staging.procureledger.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "<TENANT_ID>",
    "email": "admin@demo.test",
    "displayName": "Admin",
    "password": "password1"
  }'
```

Logowanie: https://staging.procureledger.com/login  
- Workspace: `demo`  
- Email / hasło jak wyżej

---

## Krok 8 — Smoke test (30 min)

| # | Test | OK? |
|---|------|-----|
| 1 | `/login` — Procure Ledger branding | ☐ |
| 2 | Login workspace slug | ☐ |
| 3 | Command Center ładuje się | ☐ |
| 4 | Upload faktury (stub OCR) | ☐ |
| 5 | Approval workflow | ☐ |
| 6 | Export CSV | ☐ |
| 7 | `/api/health` → `"database":"up"` | ☐ |

---

## Krok 9 — Design partner

Dla każdego klienta:

1. Utwórz **osobny tenant** (`slug` = np. `acme-partner`)
2. Invite admina przez **Admin → Users**
3. Włącz moduły w **Admin → Modules** (contracts, PR, PO)
4. Import vendorów / GL przez **Integration Center**
5. **Nie** używaj danych prod na staging

---

## Koszt (orientacyjny)

| Pozycja | USD/mies. |
|---------|-----------|
| Railway Hobby/Pro + Postgres | ~20–50 |
| Volume | wliczone |
| **Razem staging** | **~25–55** |

---

## Troubleshooting

| Problem | Rozwiązanie |
|---------|-------------|
| 502 / health fail | Sprawdź logi; czy `DATABASE_URL` jest podpięty |
| CORS error | `WEB_ORIGIN` musi = dokładny URL (https, bez `/`) |
| Bootstrap zablokowany | Waitlist → ustaw `BOOTSTRAP_TOKEN` lub tymczasowo `ALLOW_PUBLIC_BOOTSTRAP=true` |
| Pliki znikają | Dodaj volume `/data/uploads` |
| Migracja fail | Logi deploy; ręcznie: Railway shell → `pnpm prisma:deploy` |

---

## Następny krok: produkcja AWS

Gdy staging OK + DPA podpisane → [`GOLIVE_CHECKLIST.md`](./GOLIVE_CHECKLIST.md) Faza 3:

- `app.procureledger.com` → CloudFront
- `api.procureledger.com` → ECS Fargate (lub ten sam wzorzec co staging)

---

*Ostatnia aktualizacja: 2026-08-31*
