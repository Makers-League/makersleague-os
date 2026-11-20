# Agent guidelines for Makers League OS

## When you are done

1. Run the checks and fix everything they report before you say you are done. Lint errors are
   never optional; there are no warnings.

   ```sh
   bun run check   # format, then lint, typecheck and unit tests in parallel
   bun run test:db
   bun run test:integration
   bun run test:e2e
   ```

   `bun run check` does not build; CI does. Run `bun run build` too when you change
   `next.config.ts`, dependencies, or what runs on the server versus in the browser.

2. Before you push, use the app like a member would to verify your change: start it
   (`bun run dev`), log in through `/login` with a seed member (code from Mailpit at
   http://127.0.0.1:54324), click through the flows you touched in a real browser (Playwright
   is installed), and also try a role that should not have access. Add or update a Playwright
   test in `apps/web/e2e` for every user-facing change.

3. Keep this loop fast; it runs after every change. All of the above takes about 20 seconds.
   When you add a check, test or service, measure it, and fix whatever makes the loop slower
   (parallelize, cache, reseed instead of reset, no fixed waits in tests).

In a cloud container, start Docker first with `dockerd &`, then `bun run db:start` and
`bun run env:local` (writes `.env.local` from the running stack).

## Database

- Schema changes only as new files in `supabase/migrations` (`bun run db:migrate:new <name>`).
  Never edit a merged migration. Run `bun run db:reset && bun run db:types` and commit the types.
- `supabase start` does not re-run migrations on an existing volume: after any migration
  change, run `bun run db:reset`. Tests call `scripts/db-reseed.sh`, which empties the tables and
  runs `seed.sql` again in 0.2s, and only does the full reset when the migrations changed.
- Every table: `club_id` (directly or via `members`), RLS on, policies through
  `private.my_role()`, pgTAP tests per role in `supabase/tests/database`.
- Supabase CLI 3 targets the local database by default; cloud commands need `--remote`.
  Do not run cloud commands from a coding session.

## Auth and secrets

- App code uses only the publishable key and the member's session
  (`lib/supabase/server.ts`). Never import `createAdminClient` in `apps/web/app`.
- On the server use `supabase.auth.getClaims()`, never `getSession()`.
- Never commit keys, not even the local CLI defaults: GitHub push protection rejects any
  `sb_secret_...`. `.env.example` stays empty; `bun run env:local` fills `.env.local`.
- Keep email confirmation on (`enable_confirmations = true`, "Confirm email" in the cloud).
  Without it anyone can sign up with a member's address and a password.
- The allow-list hook only runs when a login is created. Former members are kept out by
  `public.sync_member_logins` (ban + sign out). Bans use a finite date (`9999-12-31`);
  GoTrue cannot read `infinity`.

## Code

- Mutations are server actions with zod validation (`lib/validation.ts`).
- The sync never deletes rows and never writes to easyVerein. Never call easyVerein's
  refresh-token endpoint: it rotates the website's production token.
- No real member data in code, fixtures, seeds or tests. Use `@example.com` addresses.
- UI text is German.
- TypeScript 7. Bun runs type checking (`bun check` per package,
  same errors as tsc 7), formatting (`bun fmt`, reads `.oxfmtrc.json`) and unit tests
  (`bun test`; tests still import from `vitest`, Bun provides that API). `next build` still
  uses the `typescript` package. Lint with `bun lint --type-aware` (also reports type errors in
  every package in one pass), which reads `oxlint.config.ts`: Cloudflare's preset
  `@cloudflare/oxlint-config` plus the project additions. `bun lint` only exists in Bun canary,
  so the `bun` devDependency pins an exact canary. `bun run` puts it first on PATH, so every
  package script (fmt, check, test, lint) runs that canary; `.bun-version` is only the
  installer and runtime for `bun install` and `bun run` itself. Run tools through
  `bun run <script>` so they match CI. The `oxlint`
  package stays only for the config's imports; nothing runs it. There is no ESLint or Prettier.
- Git hooks run through hk (`hk.pkl`, install once with `hk install`): pre-commit formats and
  lints staged files, pre-push runs `bun run check`.
- Avoid `as`: parse unknown data with zod. Narrowing assertions fail lint
  (`typescript/no-unsafe-type-assertion`); where one is really needed, disable that rule on the
  line with the reason why it holds. Never `as unknown as T`.
- Disable a lint rule only on one line, with the reason:
  `// oxlint-disable-next-line <rule> -- <reason>`.
- `next dev` writes `apps/web/AGENTS.md` (Next.js agent rules). Keep it committed.
- E2E tests run in parallel. Each test uses its own seed member (codes and data must not mix),
  and tests that are not about login use `signedIn()` from `apps/web/e2e/helpers.ts`, which
  logs in without an email.
