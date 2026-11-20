#!/usr/bin/env bash
# Runs format, lint, typecheck, unit tests and build in parallel and lists every failure,
# not just the first. Used by the CI "checks" job.
set -uo pipefail
cd "$(dirname "$0")/.."

dir=$(mktemp -d)
declare -A cmds=(
  [format]="bun fmt --check"
  [unit]="bash scripts/unit-tests.sh"
  # One turbo run, so Next's typegen runs once for lint and build. --continue reports every
  # failing task.
  [lint+typecheck+build]="bunx turbo run lint typecheck build --continue --output-logs=errors-only"
)
for name in "${!cmds[@]}"; do
  (start=$(date +%s%N); ${cmds[$name]} >"$dir/$name.log" 2>&1; echo "$? $(( ($(date +%s%N) - start) / 1000000 ))" >"$dir/$name.exit") &
done
wait

failed=()
for name in format unit lint+typecheck+build; do
  read -r code ms <"$dir/$name.exit"
  if [ "$code" = 0 ]; then status=ok; else status=FAILED; failed+=("$name"); fi
  echo "::group::$name: $status (${ms}ms)"
  cat "$dir/$name.log"
  echo "::endgroup::"
done

if [ ${#failed[@]} -gt 0 ]; then
  echo "Failed: ${failed[*]}"
  exit 1
fi
