#!/usr/bin/env bash
# Temporary: compare bun lint (canary) with oxlint on the same resolved config.
set -uo pipefail
bun --revision
bun -e 'import c from "./oxlint.config.ts"; await Bun.write(".oxlintrc.json", JSON.stringify(c, null, 2))'
mv oxlint.config.ts /tmp/oxlint.config.ts
for i in $(seq 1 40); do
  out=$(bun lint --no-script --type-aware --doctor 2>&1); rc=$?
  rule=$(grep -oE 'Invalid configuration for rule `[^`]+`' <<<"$out" | sed 's/.*`\(.*\)`/\1/')
  [ -z "$rule" ] && break
  echo "dropping options of $rule: $(grep -A1 "$rule" <<<"$out" | tail -1)"
  RULE="$rule" bun -e 'const c = await Bun.file(".oxlintrc.json").json(); const want = process.env.RULE; const norm = (k) => k.replace(/^@typescript-eslint\//, "typescript/").replace(/^eslint\//, ""); let hit = 0; for (const [k, v] of Object.entries(c.rules)) if (norm(k) === want || k === want) { c.rules[k] = Array.isArray(v) ? v[0] : v; hit++; } for (const o of c.overrides ?? []) for (const [k, v] of Object.entries(o.rules ?? {})) if (norm(k) === want) { o.rules[k] = Array.isArray(v) ? v[0] : v; hit++; } if (!hit) { console.error("no key for " + want); process.exit(1); } await Bun.write(".oxlintrc.json", JSON.stringify(c, null, 2))' || break
done
echo "=== doctor"; echo "$out" | head -80
cat > apps/web/lib/probe.ts <<'TS'
// Violations our oxlint config reports
export async function f(a: unknown, b: Array<number>) {
  debugger;
  const x = a as string;
  if (x) return x!;
  console.log(x);
  const s = `${b}`;
  let y = 1;
  y = y == 2 ? 3 : 4;
  await 5;
  return [1, 2].map(function (n) { return n * 2 + y; }) + s;
}
TS
echo "=== oxlint probe"; time bunx oxlint -c .oxlintrc.json apps/web/lib/probe.ts 2>&1 | tail -30
echo "=== bun lint probe"; time bun lint --no-script --type-aware apps/web/lib/probe.ts 2>&1 | tail -40
rm apps/web/lib/probe.ts
echo "=== oxlint repo"; time bunx oxlint -c .oxlintrc.json 2>&1 | tail -5
echo "=== bun lint repo"; time bun lint --no-script --type-aware 2>&1 | tail -40
