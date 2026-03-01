#!/usr/bin/env bash
set -euo pipefail

# Create a stub .env.local if it doesn't exist (docker-compose requires it)
if [ ! -f .env.local ]; then
  touch .env.local
fi

echo "Building images..."
docker compose build

echo "Starting services..."
docker compose up -d

echo "Waiting for API to be ready..."
sleep 10

echo "Health check..."
if curl -f http://localhost:3001/health; then
  echo ""
  echo "Local build OK"
else
  echo "Health check failed"
  docker compose logs api
  docker compose down
  exit 1
fi

docker compose down
