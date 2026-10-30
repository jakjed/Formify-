#!/usr/bin/env bash
# Recreate Procure Ledger staging on Railway (Docker app + Postgres).
#
# Auth (one of):
#   export RAILWAY_TOKEN=...     # Account token from https://railway.com/account/tokens
#   railway login --browserless  # then re-run this script
#
# Usage:
#   ./tooling/scripts/restore-railway-staging.sh
#
# After health is green + custom domain TLS:
#   BOOTSTRAP_TOKEN=... ./tooling/scripts/bootstrap-staging-demo.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if ! command -v railway >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  source "$HOME/.railway/env" 2>/dev/null || true
fi
if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI missing. Install: curl -fsSL https://railway.com/install.sh | sh" >&2
  exit 1
fi

if [[ -z "${RAILWAY_TOKEN:-}" ]] && ! railway whoami >/dev/null 2>&1; then
  echo "Not authenticated. Set RAILWAY_TOKEN or run: railway login --browserless" >&2
  exit 1
fi

PROJECT_NAME="${RAILWAY_PROJECT_NAME:-procure-ledger-staging}"
SERVICE_NAME="${RAILWAY_SERVICE_NAME:-web}"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:-$(openssl rand -hex 24)}"
SECRETS_OUT="${SECRETS_OUT:-/tmp/pl-staging-secrets.env}"

echo "==> Whoami"
railway whoami

echo "==> Create new Railway project + deploy this repo ($PROJECT_NAME / $SERVICE_NAME)"
# Cold start: create project, upload Dockerfile build, detach
railway up -y -d --new --name "$PROJECT_NAME" --service "$SERVICE_NAME"

echo "==> Add Postgres"
railway add --database postgres --json || true

echo "==> Set app env vars on $SERVICE_NAME"
# DATABASE_URL should be referenced from Postgres in the dashboard if not auto-injected.
railway variable set \
  --service "$SERVICE_NAME" \
  --skip-deploys \
  NODE_ENV=production \
  "APP_NAME=Procure Ledger" \
  PORT=3001 \
  SERVE_WEB=1 \
  WEB_ORIGIN=https://staging.procureledger.com \
  API_PUBLIC_URL=https://staging.procureledger.com \
  STORAGE_PATH=/data/uploads \
  OCR_PROVIDER=stub \
  RATE_LIMIT_WINDOW_MS=60000 \
  RATE_LIMIT_MAX=120 \
  ALLOW_PUBLIC_BOOTSTRAP=false \
  "SESSION_SECRET=$SESSION_SECRET" \
  "BOOTSTRAP_TOKEN=$BOOTSTRAP_TOKEN"

umask 077
cat >"$SECRETS_OUT" <<EOF
SESSION_SECRET=$SESSION_SECRET
BOOTSTRAP_TOKEN=$BOOTSTRAP_TOKEN
EOF
echo "Wrote secrets to $SECRETS_OUT (local only — do not commit)"

echo "==> Trigger redeploy with new vars"
railway up -y -d --service "$SERVICE_NAME"

echo ""
echo "=== Manual finish in Railway dashboard ==="
echo "1) Service $SERVICE_NAME → Variables: confirm DATABASE_URL references Postgres"
echo "2) Settings → Volumes → Add Volume mount path /data/uploads"
echo "3) Settings → Networking → Custom Domain: staging.procureledger.com"
echo "4) DNS at registrar: CNAME staging → new *.up.railway.app (replace old formify-production-b740)"
echo "5) Wait for deploy + TLS, then:"
echo "   BOOTSTRAP_TOKEN=\$(grep BOOTSTRAP_TOKEN $SECRETS_OUT | cut -d= -f2) \\"
echo "     ./tooling/scripts/bootstrap-staging-demo.sh"
echo ""
railway status || true
railway domain --service "$SERVICE_NAME" 2>/dev/null || true
