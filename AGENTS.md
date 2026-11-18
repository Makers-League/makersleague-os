# Agent guidelines for Makers League OS

## Before you push

Run what CI runs (local Supabase must be up: `pnpm db:start`):

```sh
pnpm format:check && pnpm lint --deny-warnings && pnpm typecheck && pnpm test && pnpm build
pnpm test:db
pnpm --filter @ml/easyverein test:integration
pnpm test:e2e
```

In a cloud container, start Docker first with `dockerd &`, then `pnpm db:start` and
`pnpm env:local` (writes `.env.local` from the running stack).

## Database

- Schema changes only as new files in `supabase/migrations` (`pnpm db:migrate:new <name>`).
  Never edit a merged migration. Run `pnpm db:reset && pnpm db:types` and commit the types.
- `supabase start` does not re-run migrations on an existing volume: after any migration
  change, run `pnpm db:reset`.
- Every table: `club_id` (directly or via `members`), RLS on, policies through
  `private.my_role()`, pgTAP tests per role in `supabase/tests/database`.
- Supabase CLI 3 targets the local database by default; cloud commands need `--remote`.
  Do not run cloud commands from a coding session.

## Auth and secrets

- App code uses only the publishable key and the member's session
  (`lib/supabase/server.ts`). Never import `createAdminClient` in `apps/web/app`.
- On the server use `supabase.auth.getClaims()`, never `getSession()`.
- Never commit keys, not even the local CLI defaults: GitHub push protection rejects any
  `sb_secret_...`. `.env.example` stays empty; `pnpm env:local` fills `.env.local`.
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
- TypeScript is version 7 (`tsc` is the Go-based compiler). Lint with oxlint, format with
  oxfmt; there is no ESLint or Prettier.
- `next dev` writes `apps/web/AGENTS.md` (Next.js agent rules). Keep it committed.
- E2E tests that are not about login use `signedIn()` from `apps/web/e2e/helpers.ts`:
  Supabase limits how often one address can request a code.
