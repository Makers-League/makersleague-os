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

In a cloud container, start Docker first with `dockerd &`.

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
