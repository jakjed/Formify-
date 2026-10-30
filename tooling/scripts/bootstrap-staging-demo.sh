#!/usr/bin/env bash
# Create demo workspace + admin on a fresh staging deploy.
#
#   BASE_URL=https://staging.procureledger.com \
#   BOOTSTRAP_TOKEN=... \
#   ./tooling/scripts/bootstrap-staging-demo.sh
#
# Optional overrides: DEMO_SLUG, DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME

set -euo pipefail

BASE_URL="${BASE_URL:-https://staging.procureledger.com}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:?Set BOOTSTRAP_TOKEN}"
DEMO_SLUG="${DEMO_SLUG:-demo}"
DEMO_NAME="${DEMO_NAME:-Demo Co}"
DEMO_EMAIL="${DEMO_EMAIL:-admin@demo.test}"
DEMO_PASSWORD="${DEMO_PASSWORD:-password123}"
DEMO_DISPLAY="${DEMO_DISPLAY:-Admin}"

echo "==> Health"
curl -fsS "$BASE_URL/api/health" | tee /tmp/pl-health.json
echo

echo "==> Create tenant $DEMO_SLUG"
TENANT_JSON=$(curl -fsS -X POST "$BASE_URL/api/tenants" \
  -H "Content-Type: application/json" \
  -H "X-Bootstrap-Token: $BOOTSTRAP_TOKEN" \
  -d "{\"name\":\"$DEMO_NAME\",\"slug\":\"$DEMO_SLUG\",\"region\":\"eu\"}")
echo "$TENANT_JSON" | tee /tmp/pl-tenant.json
TENANT_ID=$(python3 -c 'import json; print(json.load(open("/tmp/pl-tenant.json"))["id"])')

echo "==> Register admin $DEMO_EMAIL"
curl -fsS -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\":\"$TENANT_ID\",\"email\":\"$DEMO_EMAIL\",\"displayName\":\"$DEMO_DISPLAY\",\"password\":\"$DEMO_PASSWORD\"}" \
  | tee /tmp/pl-register.json
echo

echo "==> Login smoke"
LOGIN=$(curl -fsS -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"slug\":\"$DEMO_SLUG\",\"email\":\"$DEMO_EMAIL\",\"password\":\"$DEMO_PASSWORD\"}")
echo "$LOGIN" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d.get("token"), d; print("login ok", d["user"]["email"], d["user"]["role"])'

TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

echo "==> Enable procure modules"
for key in contracts purchase_requests purchase_orders; do
  code=$(curl -sS -o /tmp/pl-mod.json -w '%{http_code}' -X PATCH "$BASE_URL/api/modules/$key" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"enabled":true}')
  echo "  $key → HTTP $code"
done

echo "==> Configure MAIN entity PLN + NBP (if present)"
curl -fsS "$BASE_URL/api/entities" -H "Authorization: Bearer $TOKEN" > /tmp/pl-entities.json
python3 - <<'PY'
import json, urllib.request, os
ents=json.load(open("/tmp/pl-entities.json"))
token=os.environ.get("TOKEN") or open("/tmp/pl-token.txt","w")
PY
echo "$TOKEN" > /tmp/pl-token.txt
ENTITY_ID=$(python3 -c 'import json; e=json.load(open("/tmp/pl-entities.json")); print(e[0]["id"] if e else "")')
if [[ -n "$ENTITY_ID" ]]; then
  curl -fsS -X PATCH "$BASE_URL/api/entities/$ENTITY_ID" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"addressLine1":"ul. Demo 1","city":"Warszawa","country":"PL","defaultCurrency":"PLN","fxProviderKey":"nbp"}' \
    | python3 -c 'import sys,json; e=json.load(sys.stdin); print("entity", e.get("code"), e.get("defaultCurrency"), e.get("fxProviderKey"), e.get("city"))'
fi

echo ""
echo "Demo ready:"
echo "  URL:       $BASE_URL/login"
echo "  Workspace: $DEMO_SLUG"
echo "  Email:     $DEMO_EMAIL"
echo "  Password:  $DEMO_PASSWORD"
echo "Optional next: sync FX tables in Admin → Finance → FX rates (NBP backfill)."
