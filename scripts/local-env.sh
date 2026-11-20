#!/usr/bin/env bash
# Writes .env.local (repo root and apps/web) from .env.example plus the keys of
# the running local Supabase stack. The keys are local-only defaults, but they
# stay out of git so secret scanning never flags them.
set -euo pipefail
cd "$(dirname "$0")/.."

status="$(bunx supabase status -o env 2>/dev/null)"
value() { grep "^$1=" <<<"$status" | cut -d= -f2- | tr -d '"'; }

url="$(value API_URL)"
publishable="$(value PUBLISHABLE_KEY)"
secret="$(value SECRET_KEY)"
if [ -z "$secret" ]; then
  echo "Local Supabase is not running. Start it with: bun run db:start" >&2
  exit 1
fi

sed \
  -e "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=$url|" \
  -e "s|^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=.*|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishable|" \
  -e "s|^SUPABASE_SECRET_KEY=.*|SUPABASE_SECRET_KEY=$secret|" \
  .env.example > .env.local
cp .env.local apps/web/.env.local

# In GitHub Actions, also export the values to later steps.
if [ -n "${GITHUB_ENV:-}" ]; then
  grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY|EASYVEREIN_SOURCE)=' .env.local >> "$GITHUB_ENV"
fi
echo "Wrote .env.local and apps/web/.env.local"
