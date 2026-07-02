#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$DIR"

if [ ! -d "$DIR/backend/node_modules" ]; then
  echo "Installing backend dependencies..."
  cd "$DIR/backend" && npm install
fi

if [ ! -d "$DIR/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  cd "$DIR/frontend" && npm install
fi

if [ ! -f "$DIR/frontend/dist/index.html" ]; then
  echo "Building frontend..."
  cd "$DIR/frontend" && npm run build
fi

cd "$DIR/launcher"
npx tsx src/index.ts start
