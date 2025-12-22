#!/bin/bash

# Template: set environment variables in Vercel (NO SECRETS IN REPO)
#
# Usage:
# 1) Export variables in your shell (or use a secrets manager):
#    export CDP_API_KEY_ID="..."
#    export CDP_API_KEY_SECRET="..."
#    export RECEIVER_WALLET="0x..."
#    export NEXT_PUBLIC_CDP_PROJECT_ID="..."
#    export NEXT_PUBLIC_API_URL="https://<your-backend>.vercel.app"
#
# 2) Run from repo root:
#    bash set-vercel-env.example.sh
#
# NOTE:
# - This script is intentionally non-interactive and will fail if variables are missing.
# - Prefer setting vars in the Vercel Dashboard for production.

set -euo pipefail

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required env var: $name" >&2
    exit 1
  fi
}

require CDP_API_KEY_ID
require CDP_API_KEY_SECRET
require RECEIVER_WALLET
require NEXT_PUBLIC_CDP_PROJECT_ID
require NEXT_PUBLIC_API_URL

echo "Setting backend env vars..."
cd apps/demo/server
printf "%s" "$CDP_API_KEY_ID" | vercel env add CDP_API_KEY_ID production
printf "%s" "$CDP_API_KEY_SECRET" | vercel env add CDP_API_KEY_SECRET production
printf "%s" "$RECEIVER_WALLET" | vercel env add RECEIVER_WALLET production

echo "Setting frontend env vars..."
cd ../client
printf "%s" "$NEXT_PUBLIC_CDP_PROJECT_ID" | vercel env add NEXT_PUBLIC_CDP_PROJECT_ID production
printf "%s" "$NEXT_PUBLIC_API_URL" | vercel env add NEXT_PUBLIC_API_URL production

echo "Done."

