#!/usr/bin/env bash
# Puts the local database back to supabase/seed.sql in about 0.2s: empties the public tables
# and the logins, then runs the seed again. A full `supabase db reset` (about 12s, it also
# rebuilds Supabase's own schemas) only runs with --full or when the migrations changed
# since the last reset.
set -euo pipefail
cd "$(dirname "$0")/.."

project=$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)
sql() { docker exec -i "supabase_db_$project" psql -q -U postgres -v ON_ERROR_STOP=1 "$@"; }

if command -v sha256sum >/dev/null; then sha() { sha256sum; }; else sha() { shasum -a 256; }; fi
stamp=supabase/.temp/migrations.sha
hash=$(cat supabase/migrations/*.sql | sha | cut -d' ' -f1)

full=false
if [[ "${1:-}" == "--full" ]]; then
  full=true
elif [[ -f "$stamp" ]]; then
  [[ "$(cat "$stamp")" == "$hash" ]] || full=true
else
  # No stamp yet (fresh `db:start`): trust the database if it has exactly our migrations.
  files=$(for f in supabase/migrations/*.sql; do basename "$f" | cut -d_ -f1; done | sort)
  applied=$(sql -tA -c "select version from supabase_migrations.schema_migrations order by 1")
  [[ "$files" == "$applied" ]] || full=true
fi

if $full; then
  node_modules/.bin/supabase db reset
else
  {
    cat <<'SQL'
set client_min_messages = warning;
do $$ begin
  execute (
    select 'truncate ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' cascade'
    from pg_tables where schemaname = 'public'
  );
end $$;
truncate auth.users, auth.flow_state, auth.audit_log_entries cascade;
SQL
    cat supabase/seed.sql
  } | sql -1 >/dev/null
fi

mkdir -p "$(dirname "$stamp")"
echo "$hash" >"$stamp"
