-- Test data only. No real member data goes into this repo.
-- Matches packages/easyverein/fixtures/members.json, so `pnpm sync` against a
-- fresh database finds the same members.

insert into public.clubs (id, slug, name) values
  ('00000000-0000-4000-8000-000000000001', 'makers-league', 'Makers League'),
  ('00000000-0000-4000-8000-000000000002', 'test-club', 'Test Club');

insert into public.members
  (id, club_id, easyverein_id, email, first_name, last_name, status, membership_type, joined_on, left_on, role, deleted_at, synced_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '1001', 'ada@example.com',   'Ada',   'Admin',    'active',      null, '2021-03-01', null,         'admin',  null, now()),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '1002', 'bert@example.com',  'Bert',  'Vorstand', 'active',      null, '2021-03-01', null,         'board',  null, now()),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '1003', 'clara@example.com', 'Clara', 'Lötkolben','active',      null, '2022-05-15', null,         'member', null, now()),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '1004', 'david@example.com', 'David', 'Drucker',  'active',      null,'2023-01-10', null,        'member', null, now()),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '1005', 'emma@example.com',  'Emma',  'Fräse',    'active',      null, '2023-09-01', null,         'member', null, now()),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '1006', 'felix@example.com', 'Felix', 'Ehemalig', 'resigned',    null, '2021-03-01', '2025-12-31', 'member', null, now()),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '1007', 'greta@example.com', 'Greta', 'Antrag',   'application', null,           null,         null,         'member', null, now()),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '1008', 'hans@example.com',  'Hans',  'Gelöscht', 'active',      null, '2022-02-01', null,         'member', '2026-11-01', now()),
  ('10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', '1009', 'ida@example.com',   'Ida',   'Kündigt',  'active',      null, '2022-07-01', '2099-06-30', 'member', null, now()),
  ('10000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '1010', 'jonas@example.com', 'Jonas', 'Laser',    'active',      null, '2024-04-01', null,         'member', null, now()),
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '9001', 'olga@example.com',  'Olga',  'Andersclub','active',    null,           '2024-01-01', null,         'admin',  null, now());

insert into public.profiles (member_id, bio, links, visibility) values
  ('10000000-0000-4000-8000-000000000001', 'Kümmert sich um die Technik.', '["https://example.com/ada"]', 'members'),
  ('10000000-0000-4000-8000-000000000003', 'Löte gern Synthesizer.', '[]', 'members'),
  ('10000000-0000-4000-8000-000000000004', 'Nur für den Vorstand sichtbar.', '[]', 'board'),
  ('10000000-0000-4000-8000-000000000006', 'War früher dabei.', '[]', 'members'),
  ('20000000-0000-4000-8000-000000000001', 'Anderer Verein.', '[]', 'members');
