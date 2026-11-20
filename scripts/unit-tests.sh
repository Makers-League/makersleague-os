#!/usr/bin/env bash
# Unit tests in random order, each file in a fresh global object. On a pull request (BASE set
# to the merge base), only the test files the diff can reach run, unless the diff touches an
# input that can change any test's result; then everything runs.
set -euo pipefail
cd "$(dirname "$0")/.."

args=(--randomize --isolate --path-ignore-patterns='**/*.integration.test.ts')
paths=(apps/web/lib packages/easyverein/src)

if [ -n "${BASE:-}" ]; then
  # Inputs that rerun everything: dependencies, compiler and test-runner settings, CI itself.
  everything='^(bun\.lock|package\.json|.*/package\.json|bunfig\.toml|\.bun-version|.*tsconfig.*\.json|scripts/unit-tests\.sh|\.github/)'
  if git diff --name-only "$BASE" HEAD | grep -qE "$everything"; then
    echo "Diff touches a global input: running every unit test."
  else
    args+=("--changed=$BASE")
  fi
fi

bun test "${args[@]}" "${paths[@]}"
