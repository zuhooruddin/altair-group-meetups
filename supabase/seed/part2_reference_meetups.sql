-- =====================================================================
-- Seed PART 2 (adapted from altair-seed-data.sql to this schema).
--
-- Run as the database owner (hosted SQL editor) AFTER:
--   1. the migrations (npx supabase db push), and
--   2. PART 1 (the provided altair-seed-data.sql, unchanged).
--
-- Same VALUES as the provided PART 2. Differences, because of the schema:
--   * meetups are created through app.insert_meetup(), which writes the
--     meetup, its approximate area, and its exact meeting point (stored in
--     public.meetup_meeting_points) in one call;
--   * column names: created_by, starts_at, place_name, latitude, longitude.
--
-- Idempotent: it deletes ONLY the three reference meetups (by their fixed
-- ids; their RSVPs and meeting points cascade) and recreates them, so it
-- can be re-run to restore the reference state. Nothing else is touched.
-- Start times are relative to load time, so the meetups are always upcoming.
-- =====================================================================

begin;

delete from public.meetups
 where id in ('c3000000-0000-4000-8000-000000000001',
              'c3000000-0000-4000-8000-000000000002',
              'c3000000-0000-4000-8000-000000000003');

select app.insert_meetup(
  p_id         => 'c3000000-0000-4000-8000-000000000001',
  p_group_id   => 'b2000000-0000-4000-8000-000000000001',   -- Maple Street Walkers
  p_created_by => 'a1000000-0000-4000-8000-000000000001',   -- Avery Lin
  p_title      => 'Saturday morning loop',
  p_starts_at  => now() + interval '7 days',
  p_place_name => 'North gate, Linden Park',
  p_latitude   => 40.012046,
  p_longitude  => -99.984517
);

select app.insert_meetup(
  p_id         => 'c3000000-0000-4000-8000-000000000002',
  p_group_id   => 'b2000000-0000-4000-8000-000000000001',   -- Maple Street Walkers
  p_created_by => 'a1000000-0000-4000-8000-000000000002',   -- Jordan Price
  p_title      => 'Weeknight short walk',
  p_starts_at  => now() + interval '10 days',
  p_place_name => 'Front steps, Elm Avenue Library',
  p_latitude   => 40.003318,
  p_longitude  => -99.979762
);

select app.insert_meetup(
  p_id         => 'c3000000-0000-4000-8000-000000000003',
  p_group_id   => 'b2000000-0000-4000-8000-000000000002',   -- Riverside Loop Walkers
  p_created_by => 'a1000000-0000-4000-8000-000000000005',   -- Morgan Ellis
  p_title      => 'Riverside sunrise walk',
  p_starts_at  => now() + interval '8 days',
  p_place_name => 'Boathouse lot, Riverside Path',
  p_latitude   => 39.985239,
  p_longitude  => -100.009683
);

insert into public.rsvps (meetup_id, user_id) values
  ('c3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002'),   -- Jordan Price -> Saturday morning loop
  ('c3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000004'),   -- Riley Chen   -> Saturday morning loop
  ('c3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000006');   -- Casey Moreno -> Riverside sunrise walk

-- "Weeknight short walk" intentionally has no RSVPs (an empty attendee list).

commit;
