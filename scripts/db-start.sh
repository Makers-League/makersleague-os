#!/usr/bin/env bash
# Starts local Supabase with only the services the app uses. CI calls this before
# `bun install` with the Supabase CLI binary on PATH, so the image pulls overlap with setup.
set -euo pipefail
cd "$(dirname "$0")/.."
bin=node_modules/.bin/supabase
[ -x "$bin" ] || bin=supabase
exec "$bin" start -x studio,imgproxy,vector,logflare,edge-runtime,realtime,storage-api,supavisor,postgres-meta
