#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$DIR/launcher"
npx tsx src/index.ts restart
