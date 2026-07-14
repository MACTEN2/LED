#!/usr/bin/env bash
# End-to-end smoke test for LED: boots the real app against the real SQLite
# database and drives every major feature through actual HTTP requests
# (not mocks). Cleans up its own test data on exit so it's safe to re-run.
#
# Usage:
#   bash scripts/smoke-test.sh
#   PORT=4000 bash scripts/smoke-test.sh   # use a different port

set -u
cd "$(dirname "$0")/.."

PORT="${PORT:-3055}"
BASE="http://localhost:$PORT"
COOKIEJAR="$(mktemp -t led-smoke-cookies)"
LOGFILE="$(mktemp -t led-smoke-server)"
TEST_BADGE=8001
TEST_TAG="TEST-TAG-001"

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); printf "  \033[32mPASS\033[0m %s\n" "$1"; }
fail() { FAIL=$((FAIL+1)); printf "  \033[31mFAIL\033[0m %s\n" "$1"; }

get_csrf() {
    curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" "$1" | grep -o 'name="_csrf" value="[^"]*"' | head -1 | sed 's/.*value="//;s/"$//'
}

cleanup() {
    echo ""
    echo "--- Cleaning up ---"
    sqlite3 db/db.db "DELETE FROM incident_report_officers WHERE badge_number = $TEST_BADGE;" 2>/dev/null
    sqlite3 db/db.db "DELETE FROM incident_reports WHERE filed_by LIKE '%Smoke Test%' OR title = 'Smoke Test Incident';" 2>/dev/null
    sqlite3 db/db.db "DELETE FROM weapon_checkouts WHERE officer_badge = $TEST_BADGE;" 2>/dev/null
    sqlite3 db/db.db "DELETE FROM equipment_inventory WHERE asset_tag = '$TEST_TAG';" 2>/dev/null
    sqlite3 db/db.db "DELETE FROM officers WHERE badge_number = $TEST_BADGE;" 2>/dev/null
    if [ -n "${SERVER_PID:-}" ]; then
        kill "$SERVER_PID" 2>/dev/null
    fi
    rm -f "$COOKIEJAR" "$LOGFILE"
}
trap cleanup EXIT

echo "=== 1. Database file & schema ==="
if node test-db.js > /tmp/led-smoke-dbtest.log 2>&1; then
    pass "SQLite file readable, tables present"
    cat /tmp/led-smoke-dbtest.log | sed 's/^/       /'
else
    fail "Could not read db/db.db (see /tmp/led-smoke-dbtest.log)"
fi

echo ""
echo "=== 2. Demo admin account ==="
if node db/seed-demo-admin.js > /dev/null 2>&1; then
    pass "Demo admin (badge 9000) seeded/confirmed"
else
    fail "Could not seed demo admin"
fi

echo ""
echo "=== 3. Boot the app ==="
PORT="$PORT" npm start > "$LOGFILE" 2>&1 &
SERVER_PID=$!
READY=0
for i in $(seq 1 30); do
    if curl -sf "$BASE/" > /dev/null 2>&1; then READY=1; break; fi
    sleep 0.5
done
if [ "$READY" = "1" ]; then
    pass "Server listening on $BASE"
else
    fail "Server never came up (see $LOGFILE)"
    exit 1
fi

echo ""
echo "=== 4. Auth ==="
curl -s -c "$COOKIEJAR" "$BASE/" -o /dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/login" -d "badge_number=9000&password=wrong")
[ "$CODE" = "403" ] && pass "CSRF protection rejects token-less POST" || fail "Expected 403 without CSRF token, got $CODE"

TOKEN=$(get_csrf "$BASE/")
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIEJAR" -c "$COOKIEJAR" -X POST "$BASE/login" \
    --data-urlencode "badge_number=9000" --data-urlencode "password=WrongPassword" --data-urlencode "_csrf=$TOKEN")
[ "$CODE" = "302" ] && pass "Wrong password rejected (redirects, no session)" || fail "Unexpected code $CODE for wrong password"

TOKEN=$(get_csrf "$BASE/")
REDIR=$(curl -s -o /dev/null -w "%{redirect_url}" -b "$COOKIEJAR" -c "$COOKIEJAR" -X POST "$BASE/login" \
    --data-urlencode "badge_number=9000" --data-urlencode "password=Demo1234!" --data-urlencode "_csrf=$TOKEN")
[ "$REDIR" = "$BASE/dashboard" ] && pass "Correct login redirects to /dashboard" || fail "Login redirect was '$REDIR'"

HASH=$(sqlite3 db/db.db "SELECT password_hash FROM officers WHERE badge_number = 9000;")
[[ "$HASH" == \$2b\$* ]] && pass "Stored password is bcrypt-hashed, not plaintext" || fail "password_hash doesn't look like bcrypt: $HASH"

echo ""
echo "=== 5. Officers ==="
TOKEN=$(get_csrf "$BASE/officers")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/officers" \
    --data-urlencode "_csrf=$TOKEN" --data-urlencode "badge_number=$TEST_BADGE" \
    --data-urlencode "first_name=Smoke" --data-urlencode "last_name=Test" \
    --data-urlencode "dob=1990-01-01" --data-urlencode "work_email=smoke@led.local" \
    --data-urlencode "agency_name=Test Agency" --data-urlencode "password=SmokeTest123" --data-urlencode "role=User"
if sqlite3 db/db.db "SELECT 1 FROM officers WHERE badge_number = $TEST_BADGE;" | grep -q 1; then
    pass "New officer created (badge $TEST_BADGE)"
else
    fail "New officer not found in DB after create"
fi
curl -s -b "$COOKIEJAR" "$BASE/officers" | grep -q "Smoke" && pass "Roster page lists new officer" || fail "New officer missing from roster page"

echo ""
echo "=== 6. Armory / Equipment ==="
TOKEN=$(get_csrf "$BASE/equipment")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/equipment" \
    --data-urlencode "_csrf=$TOKEN" --data-urlencode "asset_tag=$TEST_TAG" \
    --data-urlencode "item_name=Smoke Test Weapon" --data-urlencode "category=Firearm" \
    --data-urlencode "status=Available"
sqlite3 db/db.db "SELECT 1 FROM equipment_inventory WHERE asset_tag='$TEST_TAG';" | grep -q 1 \
    && pass "New equipment registered ($TEST_TAG)" || fail "New equipment not found in DB"

TOKEN=$(get_csrf "$BASE/equipment")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/equipment/$TEST_TAG/checkout" --data-urlencode "_csrf=$TOKEN"
STATUS=$(sqlite3 db/db.db "SELECT status FROM equipment_inventory WHERE asset_tag='$TEST_TAG';")
[ "$STATUS" = "Deployed" ] && pass "Checkout sets status to Deployed" || fail "Status after checkout was '$STATUS'"

TOKEN=$(get_csrf "$BASE/equipment/$TEST_TAG/edit")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/equipment/$TEST_TAG/edit" \
    --data-urlencode "_csrf=$TOKEN" --data-urlencode "item_name=Smoke Test Weapon" \
    --data-urlencode "assigned_to=$TEST_BADGE"
ASSIGNED=$(sqlite3 db/db.db "SELECT assigned_to FROM equipment_inventory WHERE asset_tag='$TEST_TAG';")
[ "$ASSIGNED" = "$TEST_BADGE" ] && pass "Manual badge-number assignment works" || fail "assigned_to was '$ASSIGNED', expected $TEST_BADGE"

TOKEN=$(get_csrf "$BASE/equipment")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/equipment/$TEST_TAG/checkin" --data-urlencode "_csrf=$TOKEN"
STATUS=$(sqlite3 db/db.db "SELECT status FROM equipment_inventory WHERE asset_tag='$TEST_TAG';")
[ "$STATUS" = "Available" ] && pass "Check-in sets status back to Available" || fail "Status after checkin was '$STATUS'"

echo ""
echo "=== 7. Incident Reports ==="
TOKEN=$(get_csrf "$BASE/reports/new")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/reports" \
    --data-urlencode "_csrf=$TOKEN" --data-urlencode "title=Smoke Test Incident" \
    --data-urlencode "report_type=Incident" --data-urlencode "occurred_at=2026-01-01T10:00" \
    --data-urlencode "narrative=Automated smoke test report narrative." \
    --data-urlencode "involved_officers=$TEST_BADGE"
if sqlite3 db/db.db "SELECT 1 FROM incident_reports WHERE title='Smoke Test Incident';" | grep -q 1; then
    pass "Incident report filed with auto-generated report number"
else
    fail "Report not found in DB after filing"
fi

echo ""
echo "=== 8. Code Red ==="
TOKEN=$(get_csrf "$BASE/dashboard")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/code-red/activate" --data-urlencode "_csrf=$TOKEN"
curl -s -b "$COOKIEJAR" "$BASE/dashboard" | grep -q "CODE RED ACTIVE" && pass "Code Red banner appears after activation" || fail "Code Red banner missing"
TOKEN=$(get_csrf "$BASE/dashboard")
curl -s -b "$COOKIEJAR" -c "$COOKIEJAR" -o /dev/null -X POST "$BASE/code-red/resolve" --data-urlencode "_csrf=$TOKEN"
curl -s -b "$COOKIEJAR" "$BASE/dashboard" | grep -q "CODE RED ACTIVE" && fail "Code Red banner still showing after resolve" || pass "Code Red resolves cleanly"

echo ""
echo "=== 9. Access control ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard")
[ "$CODE" = "302" ] && pass "Unauthenticated request to /dashboard redirects" || fail "Expected 302, got $CODE"

echo ""
echo "=== 10. Audit log ==="
curl -s -b "$COOKIEJAR" "$BASE/dashboard" | grep -q "CODE_RED_ACTIVATED" && pass "Actions are being written to the audit log" || fail "Audit log entries not showing on dashboard"

echo ""
echo "===================================="
echo " Results: $PASS passed, $FAIL failed"
echo "===================================="
[ "$FAIL" -eq 0 ]
