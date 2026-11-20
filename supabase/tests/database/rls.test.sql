-- Row level security per role. Run with `bun run test:db` (supabase test db).
-- Works on the seeded database; everything happens in one rolled-back transaction.
begin;
create extension if not exists pgtap with schema extensions;

select plan(47);

-- Logins for seeded members (the trigger links them by email) and one stranger.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-000000000001', 'ada@example.com',      'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000002', 'bert@example.com',     'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000003', 'CLARA@example.com',    'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000006', 'felix@example.com',    'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000007', 'greta@example.com',    'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000008', 'hans@example.com',     'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000010', 'jonas@example.com',    'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-000000000099', 'olga@example.com',     'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000ff', 'stranger@example.com', 'authenticated', 'authenticated');

insert into public.sync_runs (club_id, source, status) values
  ('00000000-0000-4000-8000-000000000001', 'fixtures', 'succeeded'),
  ('00000000-0000-4000-8000-000000000002', 'fixtures', 'succeeded');

-- Acts as a signed-in user for the following statements.
create function pg_temp.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
end;
$$;

create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- Linking ----------------------------------------------------------------------
select is(
  (select user_id from public.members where email = 'clara@example.com'),
  'a0000000-0000-4000-8000-000000000003'::uuid,
  'a new login is linked to the member with the same email (case-insensitive)'
);

-- Email change in easyVerein moves the member to the login of the new address
update public.members set email = 'clara.neu@example.com' where email = 'clara@example.com';
select is((select user_id from public.members where email = 'clara.neu@example.com'), null,
  'a changed email unlinks the old login');
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000c1', 'clara.neu@example.com', 'authenticated', 'authenticated');
select is((select user_id from public.members where email = 'clara.neu@example.com'),
  'a0000000-0000-4000-8000-0000000000c1'::uuid, 'the login of the new address is linked');
update public.members set email = 'clara@example.com' where email = 'clara.neu@example.com';
select is((select user_id from public.members where email = 'clara@example.com'),
  'a0000000-0000-4000-8000-000000000003'::uuid, 'changing back relinks the original login');

-- Profile links are checked in the database too
select throws_ok(
  $$update public.profiles set links = '["javascript:alert(1)"]' where member_id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'profile links must be http(s) URLs');

-- Allow-list hook ----------------------------------------------------------------
select is(private.before_user_created('{"user":{"email":"Clara@Example.com"}}'), '{}'::jsonb,
  'hook lets an active member sign up');
select is(private.before_user_created('{"user":{"email":"ida@example.com"}}'), '{}'::jsonb,
  'hook lets a member with a future exit date sign up');
select is((private.before_user_created('{"user":{"email":"felix@example.com"}}') -> 'error' ->> 'http_code')::int, 403,
  'hook rejects a member who has left');
select is((private.before_user_created('{"user":{"email":"greta@example.com"}}') -> 'error' ->> 'http_code')::int, 403,
  'hook rejects an open application');
select is((private.before_user_created('{"user":{"email":"hans@example.com"}}') -> 'error' ->> 'http_code')::int, 403,
  'hook rejects a member marked deleted');
select is((private.before_user_created('{"user":{"email":"stranger@example.com"}}') -> 'error' ->> 'http_code')::int, 403,
  'hook rejects an unknown email');

-- Anonymous ------------------------------------------------------------------------
set local role anon;
select throws_ok('select count(*) from public.members', '42501', null, 'anon cannot read members');
select throws_ok('select count(*) from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select count(*) from public.clubs', '42501', null, 'anon cannot read clubs');
reset role;

-- Member (Clara) --------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select is((select count(*) from public.clubs)::int, 1, 'member sees only their club');
select results_eq(
  'select first_name from public.members order by first_name',
  array['Ada', 'Bert', 'Clara', 'David', 'Emma', 'Ida', 'Jonas'],
  'member sees active fellow members only (no left, applications, deleted or other club)'
);
select results_eq(
  'select m.first_name from public.profiles p join public.members m on m.id = p.member_id order by 1',
  array['Ada', 'Clara'],
  'member sees "members" profiles and their own, not "board" profiles or those of former members'
);
select is((select count(*) from public.sync_runs)::int, 0, 'member cannot read sync runs');
select is((select count(*) from public.active_members)::int, 7, 'active_members shows the same fellow members');
select throws_ok($$update public.active_members set role = 'admin'$$, '42501', null,
  'members cannot write through the active_members view');
select throws_ok(
  $$insert into public.members (club_id, easyverein_id, email, first_name, last_name, status)
    values ('00000000-0000-4000-8000-000000000001', 'x', 'x@example.com', 'X', 'Y', 'active')$$,
  '42501', null, 'member cannot insert members');
select throws_ok($$update public.members set role = 'admin' where email = 'clara@example.com'$$,
  '42501', null, 'member cannot change their role');
select throws_ok($$delete from public.members$$, '42501', null, 'member cannot delete members');
select lives_ok(
  $$update public.profiles set bio = 'Neu' where member_id = '10000000-0000-4000-8000-000000000003'$$,
  'member can update their own profile');
select is((select bio from public.profiles where member_id = '10000000-0000-4000-8000-000000000003'), 'Neu',
  'own profile change is saved');
update public.profiles set bio = 'Hack' where member_id = '10000000-0000-4000-8000-000000000001';
select pg_temp.logout();
select is((select bio from public.profiles where member_id = '10000000-0000-4000-8000-000000000001'),
  'Kümmert sich um die Technik.', 'member cannot update someone else''s profile');
select pg_temp.login('a0000000-0000-4000-8000-000000000003');
select throws_ok(
  $$insert into public.profiles (member_id, bio) values ('10000000-0000-4000-8000-000000000005', 'Hack')$$,
  '42501', null, 'member cannot create a profile for someone else');
select throws_ok(
  $$update public.profiles set member_id = '10000000-0000-4000-8000-000000000005'
    where member_id = '10000000-0000-4000-8000-000000000003'$$,
  '42501', null, 'member cannot move their profile to someone else');
select throws_ok($$select public.sync_member_logins('00000000-0000-4000-8000-000000000001')$$, '42501', null,
  'member cannot call the sync-only login sync');
select pg_temp.logout();

-- Member without a profile yet (Jonas) ------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000010');
select lives_ok(
  $$insert into public.profiles (member_id, bio) values ('10000000-0000-4000-8000-000000000010', 'Hallo')$$,
  'member can create their own profile');
select pg_temp.logout();

-- Board (Bert) --------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000002');
select is((select count(*) from public.members)::int, 10, 'board sees every member of the club, also former ones');
select results_eq(
  'select m.first_name from public.profiles p join public.members m on m.id = p.member_id order by 1',
  array['Ada', 'Clara', 'David', 'Felix', 'Jonas'],
  'board sees all profiles of the club, including "board" ones'
);
select is((select count(*) from public.sync_runs)::int, 0, 'board cannot read sync runs');
select is((select count(*) from public.active_members)::int, 7, 'active_members hides former members also for the board');
select pg_temp.logout();

-- Admin (Ada) --------------------------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000001');
select is((select count(*) from public.sync_runs)::int, 1, 'admin reads the sync runs of their club only');
select is((select count(*) from public.members)::int, 10, 'admin sees every member of the club');
select throws_ok($$update public.members set role = 'board' where email = 'clara@example.com'$$,
  '42501', null, 'admins also set roles with SQL for now, not from the app');
select pg_temp.logout();

-- Left (Felix), application (Greta), deleted (Hans) ------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000006');
select is((select count(*) from public.members)::int, 0, 'a member who left sees no members');
select is((select count(*) from public.profiles)::int, 0, 'a member who left sees no profiles, not even their own');
select is((select count(*) from public.clubs)::int, 0, 'a member who left sees no club');
update public.profiles set bio = 'x' where member_id = '10000000-0000-4000-8000-000000000006';
select pg_temp.logout();
select is((select bio from public.profiles where member_id = '10000000-0000-4000-8000-000000000006'),
  'War früher dabei.', 'a member who left cannot edit their profile');

select pg_temp.login('a0000000-0000-4000-8000-000000000007');
select is((select count(*) from public.members)::int, 0, 'an open application sees no members');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-000000000008');
select is((select count(*) from public.members)::int, 0, 'a member marked deleted sees no members');
select pg_temp.logout();

-- Other club (Olga) and stranger ---------------------------------------------------
select pg_temp.login('a0000000-0000-4000-8000-000000000099');
select results_eq('select first_name from public.members', array['Olga'],
  'an admin of another club sees only their own club''s members');
select results_eq('select slug from public.clubs', array['test-club'], 'and only their own club');
select is((select count(*) from public.sync_runs)::int, 1, 'and only their own club''s sync runs');
select pg_temp.logout();

select pg_temp.login('a0000000-0000-4000-8000-0000000000ff');
select is((select count(*) from public.members)::int, 0, 'a login without a member row sees nothing');
select pg_temp.logout();

select * from finish();
rollback;
