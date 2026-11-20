#!/usr/bin/env bash
# Runs format, lint, typecheck, unit tests and build in parallel and lists every failure,
# not just the first. Used by the CI "checks" job.
set -uo pipefail
cd "$(dirname "$0")/.."

dir=$(mktemp -d)
names=(format unit lint+typecheck+build)
cmds=(
  "bun run format:check"
  "bash scripts/unit-tests.sh"
  # One turbo run, so Next's typegen runs once for lint and build. --continue reports every
  # failing task.
  "bunx turbo run lint typecheck build --continue --output-logs=errors-only"
)
for i in "${!names[@]}"; do
  (start=$(date +%s%N); ${cmds[$i]} >"$dir/$i.log" 2>&1; echo "$? $(( ($(date +%s%N) - start) / 1000000 ))" >"$dir/$i.exit") &
done
wait

failed=()
for i in "${!names[@]}"; do
  read -r code ms <"$dir/$i.exit"
  if [ "$code" = 0 ]; then status=ok; else status=FAILED; failed+=("${names[$i]}"); fi
  echo "::group::${names[$i]}: $status (${ms}ms)"
  cat "$dir/$i.log"
  echo "::endgroup::"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed: ${failed[*]}"
  exit 1
fi
