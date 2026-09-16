#!/usr/bin/env bash
# Simulated end-to-end Harvest integration flow (demo mode, no real Harvest credentials)
set -euo pipefail

BASE="${1:-http://localhost:3000}"
DEMO_PARCEL="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
SEASON_ID="12"

step() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }
json() { python3 -m json.tool 2>/dev/null || cat; }

echo ""
echo "  Growa Qatar × Harvest Prediction — Simulated Integration Flow"
echo "  Base URL: $BASE"
echo "  Mode: HARVEST_DEMO_MODE (no live Harvest credentials required)"
echo ""

step "1 · Utente apre il workspace Harvest nel dashboard"
echo "  → Browser: GET /dashboard?module=harvest"
echo "  → UI carica HarvestWorkspace (pannello laterale + mappa Qatar)"

step "2 · Frontend richiede analytics aggregati (via BFF Growa)"
echo "  → GET $BASE/api/harvest/analytics?mode=current"
curl -s "$BASE/api/harvest/analytics?mode=current" | json | head -30

step "3 · Frontend richiede tabella campi"
echo "  → GET $BASE/api/harvest/fields?mode=current&perpage=50"
curl -s "$BASE/api/harvest/fields?mode=current&perpage=50" | json | head -35

step "4 · Frontend richiede serie temporale AETI (dekad)"
echo "  → GET $BASE/api/harvest/timeseries?mode=current&metric=aeti&granularity=dekad"
curl -s "$BASE/api/harvest/timeseries?mode=current&metric=aeti&granularity=dekad" | json | head -25

step "5 · Utente clicca su un campo → drill-down"
echo "  → Browser: /dashboard?module=harvest&parcelId=$DEMO_PARCEL"
echo "  → GET $BASE/api/harvest/entity/$DEMO_PARCEL"
curl -s "$BASE/api/harvest/entity/$DEMO_PARCEL" | json

step "6 · Utente avvia stima resa (task Celery simulato)"
echo "  → GET $BASE/api/harvest/yield/current/$DEMO_PARCEL/$SEASON_ID"
YIELD_RESP=$(curl -s "$BASE/api/harvest/yield/current/$DEMO_PARCEL/$SEASON_ID")
echo "$YIELD_RESP" | json
TASK_ID=$(echo "$YIELD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['task_id'])" 2>/dev/null || echo "")

if [ -n "$TASK_ID" ]; then
  step "7 · Polling stato task (simulato: completato immediatamente)"
  echo "  → GET $BASE/api/harvest/task/$TASK_ID"
  curl -s "$BASE/api/harvest/task/$TASK_ID" | json
fi

step "8 · Utente passa a modalità Predict"
echo "  → GET $BASE/api/harvest/analytics?mode=predict"
curl -s "$BASE/api/harvest/analytics?mode=predict" | json | head -20

echo ""
echo "  ✓ Flusso simulato completato"
echo "  In produzione: step 2-7 passano da Growa BFF → harvest.growa.ai (cookie server-side)"
echo ""
