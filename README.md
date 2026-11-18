# Makers League OS

Member platform of Makers League e.V.: Next.js app, Supabase (Postgres, Auth) and a one-way
sync from easyVerein. Built to serve more clubs later, so every table carries `club_id`.

> Prototype: only test data. No real member data until all services are club-owned and the
> AVVs are signed.

## Stack

| Area      | Choice                                                                     |
| --------- | -------------------------------------------------------------------------- |
| Repo      | pnpm workspaces + Turborepo                                                |
| App       | Next.js 16 (App Router, React Compiler), Tailwind CSS 4, shadcn/ui, zod    |
| Backend   | Supabase: Postgres with row level security, Auth with email code, SQL only |
| DB access | `supabase-js` with generated types, no ORM                                 |
| Email     | Lettermint as Supabase SMTP (cloud); Mailpit catches all mail locally      |
| Hosting   | Netlify (app + scheduled sync)                                             |
| Tooling   | TypeScript 7 (`tsgo`), oxlint, oxfmt (sorts imports and Tailwind classes)  |
| Tests     | Vitest, pgTAP (`supabase test db`), Playwright                             |

## Layout

```text
apps/web/                  Next.js app (member area now, public website later)
  app/(public)/login/      email + 6-digit code login
  app/auth/confirm/        handles the link in the login email
  app/(app)/               signed-in area: dashboard, own profile
  lib/supabase/            server, browser and proxy clients
  netlify/functions/       hourly sync trigger + background sync
  e2e/                     Playwright tests
packages/db/               generated Supabase types + admin client for jobs
packages/easyverein/       easyVerein adapter (fixtures | api), sync planner and runner
packages/config/           shared tsconfig
supabase/
  config.toml              local Supabase settings (auth, hook, templates)
  migrations/              SQL migrations: the only way the schema changes
  seed.sql                 fake clubs, members and profiles
  templates/               German login email
  tests/database/          pgTAP tests for every policy
```

## Getting started

Needs Node.js 22+, pnpm 10 and Docker (or OrbStack).

```sh
pnpm install
pnpm db:start     # local Supabase in Docker (first run downloads images)
pnpm env:local    # writes .env.local files with the local stack's keys
pnpm dev          # app (and Supabase, if it is not running yet)
```

- App: http://localhost:3000. Log in as any active seed member, e.g. `clara@example.com`
  (member), `bert@example.com` (board) or `ada@example.com` (admin).
- Login emails: Mailpit at http://127.0.0.1:54324.
- Supabase Studio: http://127.0.0.1:54323.

## Commands

| Command                                         | What it does                                              |
| ----------------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                                      | local Supabase + Next.js dev server                       |
| `pnpm db:migrate:new <name>`                    | new timestamped file in `supabase/migrations`             |
| `pnpm db:reset`                                 | rebuild the local DB from all migrations + `seed.sql`     |
| `pnpm db:types`                                 | regenerate `packages/db/src/database.types.ts`            |
| `pnpm sync`                                     | run the easyVerein sync against local Supabase (fixtures) |
| `pnpm lint` / `pnpm format`                     | oxlint / oxfmt                                            |
| `pnpm typecheck`                                | `tsc` from TypeScript 7 in every package                  |
| `pnpm test`                                     | unit tests (Vitest)                                       |
| `pnpm test:db`                                  | pgTAP tests for row level security                        |
| `pnpm --filter @ml/easyverein test:integration` | sync against local Supabase                               |
| `pnpm test:e2e`                                 | Playwright against local Supabase + app                   |

## Database rules

- The schema changes only through migrations. Never edit tables in the cloud dashboard; if it
  happens, capture it with `supabase db diff --remote`.
- Merged migrations are never edited. Fix forward with a new migration.
- Changes are backwards compatible (app and DB deploy in parallel): add first, use in the next
  PR, remove only when no code reads it.
- Every new table enables RLS and gets pgTAP tests for each role in the same PR.
- Commit migration, seed changes and regenerated types together. CI fails if types drift.
- The secret key bypasses RLS. Only the sync (Netlify functions) uses it, never pages or
  server actions.

## Access model

- Login is passwordless: email with a 6-digit code (or link).
- `private.before_user_created` (Auth hook) only lets emails of **active** members create a
  login. Active means: not marked deleted, not an open application, exit date not passed.
- A trigger links the login to the member row with the same email. If easyVerein changes a
  member's email, the row moves to the login of the new address (or none), so an old inbox
  loses access.
- After every run the sync bans and signs out logins without an active member row
  (`public.sync_member_logins`) and unbans them if the member is active again, because the hook
  only runs when a login is created.
- "Confirm email" stays on: otherwise anyone could sign up with a member's address and a password.
- `private.my_role(club)` returns the role of an active member and drives every policy:

| Who                        | Members                      | Profiles                 | Sync runs |
| -------------------------- | ---------------------------- | ------------------------ | --------- |
| Member                     | active fellow members        | `members` profiles + own | none      |
| Board                      | all of the club, also former | all of the club          | none      |
| Admin                      | all of the club, also former | all of the club          | read      |
| Left / deleted / applicant | none                         | none                     | none      |
| Other club                 | none of this club            | none of this club        | none      |

- Members can only edit their own profile. Nobody writes `members` from the app; roles are set
  with SQL for now.

## easyVerein sync

- One-way, read-only. `EASYVEREIN_SOURCE` must be set to `fixtures` or `api` (no default, so a
  deploy never syncs fixtures by accident).
- Upserts by `(club_id, easyverein_id)`, copies status and dates as easyVerein reports them,
  keeps `role`.
- Never deletes: members missing in easyVerein get `deleted_at` and lose access. Permanent
  deletion will be a manual, logged admin action.
- Records easyVerein returns but we cannot use (e.g. no valid email) are skipped and left as
  they are, never marked deleted. They are listed in the run's stats.
- Safety stop: if a run would mark more than 10% of members deleted (at least one is always
  allowed), it changes nothing and records a `stopped` run.
- Every run writes a `sync_runs` row with counts.
- On Netlify, `sync-trigger` (hourly) starts `sync-members-background` with `SYNC_SECRET`.

## Environments

| Variable                                                                | Where                                    | Secret |
| ----------------------------------------------------------------------- | ---------------------------------------- | ------ |
| `NEXT_PUBLIC_SUPABASE_URL`                                              | app, Netlify (all contexts)              | no     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                  | app, Netlify (all contexts)              | no     |
| `SUPABASE_SECRET_KEY`                                                   | Netlify functions (sync) only            | yes    |
| `SYNC_SECRET`                                                           | Netlify functions                        | yes    |
| `EASYVEREIN_SOURCE`, `SYNC_CLUB_SLUG`                                   | Netlify functions                        | no     |
| `EASYVEREIN_TOKEN`                                                      | later, only with `EASYVEREIN_SOURCE=api` | yes    |
| `LETTERMINT_PROJECT_TOKEN`                                              | later, app emails                        | yes    |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` | GitHub Actions secrets                   | yes    |

## CI and deploys

- `ci.yml` on every PR and push to `main`, one parallel job per check: format, lint,
  typecheck, unit tests, build, migrations + RLS tests (type drift check, pgTAP), sync
  integration tests and Playwright e2e. The last three each start a local Supabase.
- `deploy-db.yml` on merge to `main`: `supabase db push --remote` to the cloud project. It
  skips itself until the three Supabase secrets are set.
- Netlify builds deploy previews per PR and production from `main`.

## Cloud setup checklist

1. GitHub secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`, then
   run "Deploy database migrations" once by hand.
2. Supabase dashboard: Authentication > Hooks > Before User Created → Postgres function
   `private.before_user_created`.
3. Authentication > Sign In / Providers: keep "Confirm email" on.
4. Authentication > Emails: paste `supabase/templates/magic_link.html` into the Magic Link and
   Confirm signup templates; SMTP = Lettermint (`smtp.lettermint.co:465`, user `lettermint`).
5. Authentication > URL configuration: site URL and redirect URLs (localhost, production,
   Netlify preview pattern).
6. Netlify: package directory `apps/web`, env vars above, functions region next to Supabase.
