#!/bin/bash
# Test script for the job API

API_URL="${API_URL:-http://localhost:3001}"

echo "=== Testing AI 3D Platform API ==="

# Test 1: Health check
echo -e "\n[1] Testing health endpoint..."
curl -s "$API_URL/health" | head -20

# Test 2: Create a text-to-3D job
echo -e "\n\n[2] Creating text-to-3D job..."
RESPONSE=$(curl -s -X POST "$API_URL/v1/jobs" \
  -H "Content-Type: application/json" \
  -d '{"type": "text", "prompt": "A red sports car"}')

echo "Response: $RESPONSE"

JOB_ID=$(echo $RESPONSE | grep -o '"jobId":"[^"]*"' | cut -d'"' -f4)
echo "Job ID: $JOB_ID"

if [ -z "$JOB_ID" ]; then
  echo "Failed to create job!"
  exit 1
fi

# Test 3: Get job status (should be queued)
echo -e "\n[3] Getting job status (should be queued)..."
curl -s "$API_URL/v1/jobs/$JOB_ID"

# Test 4: Wait and poll for status
echo -e "\n\n[4] Polling job status..."
for i in {1..10}; do
  STATUS=$(curl -s "$API_URL/v1/jobs/$JOB_ID" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  echo "Attempt $i: Status = $STATUS"

  if [ "$STATUS" = "succeeded" ]; then
    echo "Job completed!"
    ASSET_ID=$(curl -s "$API_URL/v1/jobs/$JOB_ID" | grep -o '"assetId":"[^"]*"' | cut -d'"' -f4)
    echo "Asset ID: $ASSET_ID"

    # Test 5: Get asset
    echo -e "\n[5] Getting asset..."
    curl -s "$API_URL/v1/assets/$ASSET_ID"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "Job failed!"
    break
  fi

  sleep 2
done

echo -e "\n\n=== Test Complete ==="
