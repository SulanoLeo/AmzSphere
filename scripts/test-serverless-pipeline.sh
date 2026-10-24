#!/usr/bin/env bash
#
# AmzSphere Serverless Pipeline Verification Script
# Tests the end-to-end webhook -> outbox -> PDF compilation pipeline
# against a locally running FastAPI server (uvicorn on port 8001).
#
# Usage:
#   ADMIN_WEBHOOK_SECRET=test-secret ./scripts/test-serverless-pipeline.sh
#
set -euo pipefail

###############################################################################
# Configuration
###############################################################################
BASE_URL="${BASE_URL:-http://localhost:8001}"
ADMIN_SECRET="${ADMIN_WEBHOOK_SECRET:-test-secret}"
WEBHOOK_ENDPOINT="${BASE_URL}/api/v1/webhooks/amazon-notifications"
OUTBOX_EXECUTE_ENDPOINT="${BASE_URL}/api/v1/amazon-writes/execute"
PDF_COMPILE_ENDPOINT="${BASE_URL}/api/v1/procurement/pdf/compile-batch"
MOCK_PAYLOAD_FILE="${MOCK_PAYLOAD_FILE:-backend/app/webhooks/mock_listing_suppressed_payload.json}"

PASS_COUNT=0
FAIL_COUNT=0

###############################################################################
# Helpers
###############################################################################
log_pass() {
  echo "[PASS] $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

log_fail() {
  echo "[FAIL] $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

assert_http_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  if [ "$actual" = "$expected" ]; then
    log_pass "$label (HTTP $actual)"
  else
    log_fail "$label (expected HTTP $expected, got HTTP $actual)"
  fi
}

assert_json_contains() {
  local json="$1"
  local key="$2"
  local expected="$3"
  local label="$4"
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key','__MISSING__'))" 2>/dev/null || echo "__ERROR__")
    if [ "${actual,,}" = "${expected,,}" ]; then
    log_pass "$label ($key=$actual)"
  else
    log_fail "$label ($key expected '$expected', got '$actual')"
  fi
}

assert_json_key_exists() {
  local json="$1"
  local key="$2"
  local label="$3"
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('__HAS__' if '$key' in d else '__MISSING__')" 2>/dev/null || echo "__ERROR__")
  if [ "$actual" = "__HAS__" ]; then
    log_pass "$label (key '$key' present)"
  else
    log_fail "$label (key '$key' missing)"
  fi
}

###############################################################################
# Pre-flight checks
###############################################################################
echo "============================================================"
echo " AmzSphere Serverless Pipeline Verification"
echo "============================================================"
echo "Base URL:        $BASE_URL"
echo "Admin Secret:    $ADMIN_SECRET"
echo "Mock payload:    $MOCK_PAYLOAD_FILE"
echo "============================================================"

if [ ! -f "$MOCK_PAYLOAD_FILE" ]; then
  log_fail "Mock payload file not found: $MOCK_PAYLOAD_FILE"
  echo "Aborting."
  exit 1
fi

###############################################################################
# Step 1: Webhook ingestion - LISTING_ITEM_STATUS_CHANGE
###############################################################################
echo ""
echo "--- Step 1: Amazon notification webhook ingestion ---"

WEBHOOK_RESPONSE=$(curl -s -o /tmp/webhook_body.txt -w "%{http_code}" \
  -X POST "$WEBHOOK_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-workspace-user: test-tenant" \
  -H "x-amz-sns-message-signature: test-sig" \
  --data @"$MOCK_PAYLOAD_FILE" || true)

assert_http_status "$WEBHOOK_RESPONSE" "202" "Webhook accepted"

WEBHOOK_BODY=$(cat /tmp/webhook_body.txt)
assert_json_key_exists "$WEBHOOK_BODY" "accepted" "Webhook response has accepted field"
assert_json_contains "$WEBHOOK_BODY" "accepted" "true" "Webhook accepted is true"
assert_json_key_exists "$WEBHOOK_BODY" "notification_id" "Webhook response has notification_id"

###############################################################################
# Step 2: Outbox execution trigger
###############################################################################
echo ""
echo "--- Step 2: Outbox payload execution (serverless cron simulation) ---"

OUTBOX_RESPONSE=$(curl -s -o /tmp/outbox_body.txt -w "%{http_code}" \
  -X POST "$OUTBOX_EXECUTE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" || true)

assert_http_status "$OUTBOX_RESPONSE" "202" "Outbox execute accepted"

OUTBOX_BODY=$(cat /tmp/outbox_body.txt)
assert_json_key_exists "$OUTBOX_BODY" "processed" "Outbox response has processed field"
assert_json_key_exists "$OUTBOX_BODY" "published" "Outbox response has published field"
assert_json_key_exists "$OUTBOX_BODY" "message" "Outbox response has message field"

###############################################################################
# Step 3: PDF batch compilation trigger
###############################################################################
echo ""
echo "--- Step 3: PDF batch compilation trigger ---"

PDF_RESPONSE=$(curl -s -o /tmp/pdf_body.txt -w "%{http_code}" \
  -X POST "$PDF_COMPILE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" || true)

assert_http_status "$PDF_RESPONSE" "202" "PDF compile accepted"

PDF_BODY=$(cat /tmp/pdf_body.txt)
assert_json_key_exists "$PDF_BODY" "processed" "PDF response has processed field"
assert_json_key_exists "$PDF_BODY" "succeeded" "PDF response has succeeded field"
assert_json_key_exists "$PDF_BODY" "failed" "PDF response has failed field"
assert_json_key_exists "$PDF_BODY" "message" "PDF response has message field"

###############################################################################
# Step 4: Secret rejection test
###############################################################################
echo ""
echo "--- Step 4: Admin secret rejection (negative test) ---"

BAD_SECRET_RESPONSE=$(curl -s -o /tmp/bad_secret_body.txt -w "%{http_code}" \
  -X POST "$OUTBOX_EXECUTE_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: wrong-secret" || true)

assert_http_status "$BAD_SECRET_RESPONSE" "401" "Bad admin secret rejected"

###############################################################################
# Summary
###############################################################################
echo ""
echo "============================================================"
echo " Verification Summary"
echo "============================================================"
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"
echo "============================================================"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "Pipeline verification FAILED."
  exit 1
else
  echo "Pipeline verification PASSED."
  exit 0
fi
