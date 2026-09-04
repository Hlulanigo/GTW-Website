#!/bin/bash
set -e

npm install --prefer-offline

if command -v npx &> /dev/null && [ -f "drizzle.config.ts" ]; then
  npx drizzle-kit push --force 2>/dev/null || echo "DB push skipped or failed non-fatally"
fi
