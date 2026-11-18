# Agent guidelines for Makers League OS

Read README.md first. It holds the stack, commands and rules; this file lists what agents get
wrong most often.

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

## Rules

- Schema changes only as new files in `supabase/migrations` (`pnpm db:migrate:new <name>`).
  Never edit a merged migration. Run `pnpm db:reset && pnpm db:types` and commit the types.
- Every table: `club_id` (directly or via `members`), RLS on, policies through
  `private.my_role()`, pgTAP tests per role in `supabase/tests/database`.
- Supabase CLI 3 targets the local database by default; cloud commands need `--remote`.
  Do not run cloud commands from a coding session.
- App code uses only the publishable key and the member's session
  (`lib/supabase/server.ts`). Never import `createAdminClient` in `apps/web/app`.
- On the server use `supabase.auth.getClaims()`, never `getSession()`.
- Mutations are server actions with zod validation (`lib/validation.ts`).
- The sync never deletes rows and never writes to easyVerein. Never call easyVerein's
  refresh-token endpoint: it rotates the website's production token.
- No real member data in code, fixtures, seeds or tests. Use `@example.com` addresses.
- UI text is German.
- TypeScript is version 7 (`tsc` is the Go-based compiler). Lint with oxlint, format with
  oxfmt; there is no ESLint or Prettier.

## Lessons learned

- `supabase start` on an existing Docker volume does not re-run migrations. After editing a
  migration, run `pnpm db:reset` (and `pnpm db:types`).
- GitHub push protection rejects any `sb_secret_...` key, even the local CLI default. Never
  commit keys: `.env.example` stays empty and `pnpm env:local` fills `.env.local`.
- Keep `enable_confirmations = true` in `supabase/config.toml` and "Confirm email" on in the
  cloud. Without it anyone can sign up with a member's address and a password, and the
  allow-list hook lets it through because it only checks the address.
- The allow-list hook runs only when a login is created. Former members are kept out by the
  sync (`public.sync_member_logins` bans and signs them out). Ban with a finite date such as
  `9999-12-31`: GoTrue cannot read `infinity`.
- Supabase limits how often one address can request a code. E2E tests that are not about
  login use `signedIn()` from `apps/web/e2e/helpers.ts`, which reuses the session.
- Next.js' own route announcer also has `role="alert"`. Find form errors in tests with
  `getByTestId("form-error")`.
- `next dev` writes `apps/web/AGENTS.md` (Next.js agent rules). Keep it committed.
- The cloud Supabase project is in eu-west-1 (Ireland); put Netlify functions in the same
  region.
