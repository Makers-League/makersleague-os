#!/usr/bin/env bash
# Runs every package's `test` script (the flags live there). On a pull request (BASE set to the
# merge base), only the test files the diff can reach run, unless the diff touches an input that
# can change any test's result; then everything runs.
set -euo pipefail
cd "$(dirname "$0")/.."

extra=()
if [ -n "${BASE:-}" ]; then
  # Inputs that rerun everything: dependencies, compiler and test-runner settings, CI itself.
  everything='^(bun\.lock|package\.json|.*/package\.json|bunfig\.toml|\.bun-version|.*tsconfig.*\.json|turbo\.json|scripts/unit-tests\.sh|\.github/)'
  if git diff --name-only "$BASE" HEAD | grep -qE "$everything"; then
    echo "Diff touches a global input: running every unit test."
  else
    extra=(-- "--changed=$BASE")
  fi
fi

exec bunx turbo run test --output-logs=errors-only "${extra[@]}"
