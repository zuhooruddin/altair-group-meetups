-- =====================================================================
-- Bonus: creator-only editing of title, start time and meeting point.
--
-- Enforcement:
--   * RLS: the existing meetups_update_creator policy plus a new creator-only
--     update policy on meetup_meeting_points. The client-facing
--     `authenticated` role still has no write grant at all.
--   * Column grants: the writer may change title and starts_at (and, as
--     before, status/cancelled_at), and the meeting point's name and
--     coordinates. Never group_id, created_by or the area columns.
--   * Triggers: a changed start time must be in the future (AL006); a
--     cancelled meetup cannot be edited (AL004); when the coordinates
--     change, the approximate area is recomputed so it describes the new
--     spot (a fresh random offset, computed once, like at creation).
--
-- Owner exemption: the area columns, and a start time in the past, may only
-- be written by the table owner: i.e. the SECURITY DEFINER trigger below,
-- the seed, or test setup ("a started meetup"). Member writes go through
-- altair_api_writer and can never touch them.
-- =====================================================================

grant update (title, starts_at) on table public.meetups to altair_api_writer;
grant update (place_name, latitude, longitude) on table public.meetup_meeting_points to altair_api_writer;

create function app.is_table_owner(p_table regclass)
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user = (select pg_catalog.pg_get_userbyid(c.relowner) from pg_catalog.pg_class c where c.oid = p_table)
$$;

revoke all on function app.is_table_owner(regclass) from public;
grant execute on function app.is_table_owner(regclass) to altair_api_writer;

-- Replaces the guard from 20261029120100_meetup_rules.sql.
create or replace function app.guard_meetup_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_by_owner boolean := app.is_table_owner('public.meetups'::regclass);
begin
  if old.status = 'cancelled' then
    raise exception 'A cancelled meetup is final and cannot be changed or reopened'
      using errcode = 'AL004';
  end if;

  if new.id            is distinct from old.id
     or new.group_id   is distinct from old.group_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'id, group, creator and created_at of a meetup cannot be changed'
      using errcode = 'AL005';
  end if;

  if not v_by_owner and (
       new.area_center_lat is distinct from old.area_center_lat
       or new.area_center_lng is distinct from old.area_center_lng
       or new.area_radius_m   is distinct from old.area_radius_m) then
    raise exception 'the approximate area is computed by the database'
      using errcode = 'AL005';
  end if;

  if not v_by_owner
     and new.starts_at is distinct from old.starts_at
     and new.starts_at <= now() then
    raise exception 'starts_at must be in the future' using errcode = 'AL006';
  end if;

  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

-- Meeting point edits: refuse on cancelled meetups, keep the meetup link
-- fixed, and recompute the approximate area when the coordinates move.
-- SECURITY DEFINER so it may write the area columns (owner-only, above).
-- It only ever runs for rows the caller's RLS already let them update.
create function app.on_meeting_point_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_area   record;
begin
  if new.meetup_id is distinct from old.meetup_id then
    raise exception 'a meeting point cannot move to another meetup' using errcode = 'AL005';
  end if;

  select m.status into v_status from public.meetups m where m.id = new.meetup_id for update;
  if v_status = 'cancelled' then
    raise exception 'A cancelled meetup cannot be edited' using errcode = 'AL004';
  end if;

  if new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude then
    select * into v_area from app.approximate_area(new.latitude, new.longitude);
    update public.meetups
       set area_center_lat = v_area.center_lat,
           area_center_lng = v_area.center_lng,
           area_radius_m   = v_area.radius_m
     where id = new.meetup_id;
  end if;

  return new;
end;
$$;

revoke all on function app.on_meeting_point_update() from public;

create trigger meeting_points_on_update
  before update on public.meetup_meeting_points
  for each row execute function app.on_meeting_point_update();

-- Creator-only and still a member. (Cancelled meetups are refused by the
-- trigger above with AL004, so the caller gets a clear error, not 0 rows.)
create policy meeting_points_update_creator on public.meetup_meeting_points
  for update to altair_api_writer
  using (
    exists (
      select 1 from public.meetups m
       where m.id = meetup_id
         and m.created_by = (select app.current_user_id())
         and app.is_group_member(m.group_id)
    )
  )
  with check (
    exists (
      select 1 from public.meetups m
       where m.id = meetup_id and m.created_by = (select app.current_user_id())
    )
  );
