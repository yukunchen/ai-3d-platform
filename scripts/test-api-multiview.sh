#!/bin/bash
# Test script for multiview 3D job lifecycle

set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
FRONT_URL="${FRONT_URL:-https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1024}"
LEFT_URL="${LEFT_URL:-https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1024}"
RIGHT_URL="${RIGHT_URL:-https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1024}"
PROVIDER="${PROVIDER:-}"

echo "=== Testing AI 3D Platform Multiview API ==="

echo -e "\n[1] Health check..."
curl -s "$API_URL/health" | head -20

echo -e "\n\n[2] Creating multiview-to-3D job..."
if [ -n "$PROVIDER" ]; then
  BODY=$(cat <<JSON
{"type":"multiview","prompt":"A toy car from three views","viewImages":{"front":"$FRONT_URL","left":"$LEFT_URL","right":"$RIGHT_URL"},"provider":"$PROVIDER"}
JSON
)
else
  BODY=$(cat <<JSON
{"type":"multiview","prompt":"A toy car from three views","viewImages":{"front":"$FRONT_URL","left":"$LEFT_URL","right":"$RIGHT_URL"}}
JSON
)
fi

RESPONSE=$(curl -s -X POST "$API_URL/v1/jobs" -H "Content-Type: application/json" -d "$BODY")
echo "Response: $RESPONSE"

JOB_ID=$(echo "$RESPONSE" | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"

if [ -z "$JOB_ID" ]; then
  echo "Failed to create multiview job!"
  exit 1
fi

echo -e "\n[3] Polling job status..."
for i in {1..40}; do
  STATUS_JSON=$(curl -s "$API_URL/v1/jobs/$JOB_ID")
  STATUS=$(echo "$STATUS_JSON" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "Attempt $i: $STATUS_JSON"

  if [ "$STATUS" = "succeeded" ]; then
    ASSET_ID=$(echo "$STATUS_JSON" | grep -o '"assetId":"[^"]*"' | cut -d'"' -f4)
    echo "Job completed. Asset ID: $ASSET_ID"
    echo -e "\n[4] Getting asset..."
    curl -s "$API_URL/v1/assets/$ASSET_ID"
    echo
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Job failed."
    break
  fi

  sleep 3
done

echo -e "\n=== Multiview Test Complete ==="
