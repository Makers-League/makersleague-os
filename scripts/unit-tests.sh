#!/usr/bin/env bash
# Runs every package's `test` script (the flags live there). On a pull request (BASE set to the
# merge base), only the test files the diff can reach run. `--changed` only follows imports, so
# any changed file that is not source code (data a test reads, dependencies, configs, CI) runs
# everything.
set -euo pipefail
cd "$(dirname "$0")/.."

extra=()
if [ -n "${BASE:-}" ]; then
  changed=$(git diff --name-only "$BASE" HEAD)
  # Files --changed can trace or that no unit test reads. Everything else reruns all tests.
  traced='\.(ts|tsx|mts|js|mjs|md|css|sql)$'
  if grep -vE "$traced" <<<"$changed" | grep -q .; then
    echo "Diff touches a file outside the import graph: running every unit test."
    grep -vE "$traced" <<<"$changed" | head -5
  else
    extra=(-- "--changed=$BASE")
  fi
fi

exec bunx turbo run test --output-logs=errors-only "${extra[@]}"
