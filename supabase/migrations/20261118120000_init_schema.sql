-- Makers League OS: initial schema
--
-- Every table carries club_id (directly or via members) so more clubs can be
-- added later. Row level security is on for every table. Only the sync (with
-- the secret key, which bypasses RLS) writes members and sync_runs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  created_at timestamptz not null default now()
);

comment on table public.clubs is 'One row per club (Makers League first).';

create table public.members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs on delete cascade,
  easyverein_id text not null,
  user_id uuid references auth.users on delete set null,
  email text not null check (email = lower(email)),
  first_name text not null,
  last_name text not null,
  -- copied as easyVerein reports it: application, active or resigned
  status text not null check (status in ('application', 'active', 'resigned')),
  membership_type text,
  joined_on date,
  left_on date,
  role text not null default 'member' check (role in ('member', 'board', 'admin')),
  synced_at timestamptz,
  -- set by the sync when the member no longer exists in easyVerein;
  -- rows are never deleted automatically
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (club_id, easyverein_id)
);

comment on table public.members is
  'Mirror of easyVerein members. Written only by the sync; role is set by admins.';

create index members_email_idx on public.members (email);
create index members_user_id_idx on public.members (user_id);

create table public.profiles (
  member_id uuid primary key references public.members on delete cascade,
  bio text check (char_length(bio) <= 2000),
  avatar_path text,
  -- http(s) URLs only, also for writes that bypass the app's validation
  links jsonb not null default '[]' check (
    jsonb_typeof(links) = 'array'
    and jsonb_array_length(links) <= 5
    and jsonb_path_exists(links, '$[*] ? (@.type() != "string" || !(@ like_regex "^https?://"))') = false
  ),
  visibility text not null default 'members' check (visibility in ('members', 'board')),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Everything a member adds about themself.';

create table public.sync_runs (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs on delete cascade,
  source text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed', 'stopped')),
  stats jsonb,
  error text
);

create index sync_runs_club_started_idx on public.sync_runs (club_id, started_at desc);

-- ---------------------------------------------------------------------------
-- Helpers in a schema the API does not expose
-- ---------------------------------------------------------------------------

create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, supabase_auth_admin;

-- A member may use the OS while they are in easyVerein, are not an open
-- application and their exit date has not passed.
create function private.is_active(m public.members)
returns boolean
language sql
stable
set search_path = ''
as $$
  select m.deleted_at is null
    and m.status <> 'application'
    and (m.left_on is null or m.left_on > current_date)
$$;

-- The signed-in user's role in a club, or null if they are not an active member.
create function private.my_role(club uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.members m
  where m.club_id = club
    and m.user_id = (select auth.uid())
    and private.is_active(m)
  limit 1
$$;

-- True if the signed-in user is the active member behind this member row.
create function private.is_own_member(member uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.id = member
      and m.user_id = (select auth.uid())
      and private.is_active(m)
  )
$$;

revoke all on function private.is_active(public.members) from public;
revoke all on function private.is_own_member(uuid) from public;
grant execute on function private.is_own_member(uuid) to authenticated;
revoke all on function private.my_role(uuid) from public;
grant execute on function private.is_active(public.members) to authenticated, supabase_auth_admin;
grant execute on function private.my_role(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Auth: allow-list and linking
-- ---------------------------------------------------------------------------

-- Before User Created hook: only active members can get a login at all.
-- Wired up in supabase/config.toml and, for the cloud project, in the dashboard
-- (Authentication > Hooks).
create function private.before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  new_email text := lower(event -> 'user' ->> 'email');
begin
  if new_email is not null and exists (
    select 1 from public.members m
    where m.email = new_email and private.is_active(m)
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Only active members can sign in.'
    )
  );
end;
$$;

revoke all on function private.before_user_created(jsonb) from public;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;

-- Link a new login to the member rows with the same email.
create function private.link_member_to_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.members
  set user_id = new.id
  where email = lower(new.email)
    and user_id is null;
  return new;
end;
$$;

revoke all on function private.link_member_to_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.link_member_to_user();

-- A member synced after their login exists gets linked too. When easyVerein
-- changes a member's email, the row follows the login of the new address (or
-- none), so whoever holds the old inbox loses access.
create function private.link_user_to_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := null;
  end if;
  if new.user_id is null then
    select u.id into new.user_id
    from auth.users u
    where lower(u.email) = new.email
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function private.link_user_to_member() from public;

create trigger link_user_on_member_insert
  before insert on public.members
  for each row execute function private.link_user_to_member();

create trigger relink_user_on_member_email_change
  before update of email on public.members
  for each row
  when (old.email is distinct from new.email)
  execute function private.link_user_to_member();

-- Brings logins in line with membership, from the current state (not from what
-- changed), so a run that failed half-way is caught up by the next one:
-- a login without any active member row is banned and signed out, a login
-- whose member is active again is unbanned. The ban matters because the
-- allow-list hook only runs when a login is created. Only the sync
-- (service_role) may call it. Returns the number of sessions ended.
create function public.sync_member_logins(club uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked integer;
begin
  with logins as (
    select m.user_id,
      bool_or(private.is_active(a)) is true as active
    from public.members m
    left join public.members a on a.user_id = m.user_id
    where m.club_id = club and m.user_id is not null
    group by m.user_id
  ),
  bans as (
    update auth.users u
    set banned_until = case when l.active then null else '9999-12-31'::timestamptz end
    from logins l
    where u.id = l.user_id
      and u.banned_until is distinct from
        case when l.active then null else '9999-12-31'::timestamptz end
    returning 1
  ),
  ended as (
    delete from auth.sessions s
    using logins l
    where s.user_id = l.user_id and not l.active
    returning 1
  )
  select count(*) into revoked from ended;

  return revoked;
end;
$$;

revoke all on function public.sync_member_logins(uuid) from public, anon, authenticated;
grant execute on function public.sync_member_logins(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.clubs enable row level security;
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.sync_runs enable row level security;

-- Nothing is readable without a login.
revoke all on public.clubs, public.members, public.profiles, public.sync_runs from anon;

-- The app may only read members, clubs and sync runs; profiles are the one
-- table members write.
revoke insert, update, delete, truncate on public.clubs, public.members, public.sync_runs
  from authenticated;

create policy "members see their club"
  on public.clubs for select to authenticated
  using (private.my_role(id) is not null);

-- Active members see active fellow members; board and admins also see
-- members who left or were removed in easyVerein.
create policy "members see fellow members"
  on public.members for select to authenticated
  using (
    (private.is_active(members) and private.my_role(club_id) is not null)
    or private.my_role(club_id) in ('board', 'admin')
  );

create policy "profiles visible by setting"
  on public.profiles for select to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = member_id
        and private.my_role(m.club_id) is not null
        and (
          m.user_id = (select auth.uid())
          or (profiles.visibility = 'members' and private.is_active(m))
          or private.my_role(m.club_id) in ('board', 'admin')
        )
    )
  );

create policy "members create own profile"
  on public.profiles for insert to authenticated
  with check (
    private.is_own_member(member_id)
  );

create policy "members edit own profile"
  on public.profiles for update to authenticated
  using (
    private.is_own_member(member_id)
  )
  with check (
    private.is_own_member(member_id)
  );

create policy "admins read sync runs"
  on public.sync_runs for select to authenticated
  using (private.my_role(club_id) = 'admin');

-- Active members only, for lists such as the member directory. security_invoker
-- keeps the members policies in force for whoever queries the view.
create view public.active_members
with (security_invoker = true)
as
  select m.* from public.members m where private.is_active(m);

revoke all on public.active_members from anon;

-- Keep profiles.updated_at current.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();
