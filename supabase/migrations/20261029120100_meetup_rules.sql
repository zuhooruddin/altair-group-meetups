-- =====================================================================
-- Domain rules enforced in the database, whoever writes.
--
-- Custom SQLSTATEs (mapped to HTTP errors by the API's repositories):
--   AL001  meetup not found (or not visible to the RSVPing member)
--   AL002  meetup is cancelled: no new RSVPs
--   AL003  meetup has already started: no new RSVPs
--   AL004  cancelled meetups are final: no further changes, no reopening
--   AL005  attempted change to an immutable meetup column
--   AL006  start time must be in the future when a meetup is created
-- =====================================================================

-- ---------------------------------------------------------------------
-- Approximate area: a circle of radius 400 m whose center is the exact
-- point moved 120-280 m in a random direction.
--
-- * Computed once at creation and stored, never re-randomised per request,
--   so repeated reads cannot be averaged back to the exact point.
-- * The exact point is always inside the circle (offset < radius), so the
--   area is honest: "the meeting point is somewhere in here".
-- * The minimum offset of 120 m guarantees the center is never the exact
--   point (or close to it); a plain grid snap cannot guarantee that.
-- * The offset is random per meetup, so learning one meetup's exact point
--   (by RSVPing) reveals nothing about any other meetup's offset.
-- ---------------------------------------------------------------------
create function app.approximate_area(
  p_latitude  double precision,
  p_longitude double precision,
  out center_lat double precision,
  out center_lng double precision,
  out radius_m   integer
)
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_radius_m        constant integer          := 400;
  c_min_offset_m    constant double precision := 120;
  c_max_offset_m    constant double precision := 280;
  c_m_per_deg_lat   constant double precision := 111320;
  v_offset_m        double precision := c_min_offset_m + random() * (c_max_offset_m - c_min_offset_m);
  v_bearing         double precision := random() * 2 * pi();
  v_m_per_deg_lng   double precision := c_m_per_deg_lat * greatest(cos(radians(p_latitude)), 0.01);
begin
  center_lat := least(90, greatest(-90, p_latitude + v_offset_m * cos(v_bearing) / c_m_per_deg_lat));
  center_lng := p_longitude + v_offset_m * sin(v_bearing) / v_m_per_deg_lng;
  -- wrap across the antimeridian into [-180, 180)
  center_lng := center_lng - 360 * floor((center_lng + 180) / 360);
  radius_m   := c_radius_m;
end;
$$;

comment on function app.approximate_area is
  'Randomly offset (120-280 m) center + 400 m radius. Called once per meetup at creation.';

-- ---------------------------------------------------------------------
-- app.insert_meetup: the one way a meetup is created. Writes the meetup
-- (with its approximate area) and the exact meeting point atomically.
-- SECURITY INVOKER: when the API calls it as altair_api_writer, the RLS
-- insert policies still apply (creator = caller, caller is a member).
-- The seed calls it as the database owner.
-- ---------------------------------------------------------------------
create function app.insert_meetup(
  p_group_id    uuid,
  p_created_by  uuid,
  p_title       text,
  p_starts_at   timestamptz,
  p_place_name  text,
  p_latitude    double precision,
  p_longitude   double precision,
  p_id          uuid default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_area record;
  v_id   uuid;
begin
  if p_starts_at <= now() then
    raise exception 'starts_at must be in the future' using errcode = 'AL006';
  end if;

  select * into v_area from app.approximate_area(p_latitude, p_longitude);

  insert into public.meetups
    (id, group_id, created_by, title, starts_at, area_center_lat, area_center_lng, area_radius_m)
  values
    (coalesce(p_id, gen_random_uuid()), p_group_id, p_created_by, p_title, p_starts_at,
     v_area.center_lat, v_area.center_lng, v_area.radius_m)
  returning id into v_id;

  insert into public.meetup_meeting_points (meetup_id, place_name, latitude, longitude)
  values (v_id, p_place_name, p_latitude, p_longitude);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Meetup updates: cancelled is final, identity columns are immutable.
-- ---------------------------------------------------------------------
create function app.guard_meetup_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'cancelled' then
    raise exception 'A cancelled meetup is final and cannot be changed or reopened'
      using errcode = 'AL004';
  end if;

  if new.id              is distinct from old.id
     or new.group_id     is distinct from old.group_id
     or new.created_by   is distinct from old.created_by
     or new.created_at   is distinct from old.created_at
     or new.area_center_lat is distinct from old.area_center_lat
     or new.area_center_lng is distinct from old.area_center_lng
     or new.area_radius_m   is distinct from old.area_radius_m then
    raise exception 'id, group, creator, created_at and area of a meetup cannot be changed'
      using errcode = 'AL005';
  end if;

  if new.status = 'cancelled' and new.cancelled_at is null then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

create trigger meetups_guard_update
  before update on public.meetups
  for each row execute function app.guard_meetup_update();

-- ---------------------------------------------------------------------
-- RSVP inserts: the RSVPing user must be a member of the meetup's group,
-- and the meetup must be scheduled and not yet started.
--
-- SECURITY DEFINER so it can lock the meetup row regardless of the caller's
-- RLS view. FOR SHARE conflicts with the creator's cancelling UPDATE, so an
-- RSVP and a concurrent cancel are serialised: either the RSVP commits
-- first (and stays, like any existing attendee) or it sees the cancellation
-- and is rejected. Nothing is returned to the caller except an error code,
-- and a non-member always gets AL001 (not found) before any status check,
-- so outsiders learn nothing about the meetup.
-- ---------------------------------------------------------------------
create function app.guard_rsvp_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id  uuid;
  v_status    text;
  v_starts_at timestamptz;
begin
  select m.group_id, m.status, m.starts_at
    into v_group_id, v_status, v_starts_at
    from public.meetups m
   where m.id = new.meetup_id
     for share;

  if not found or not exists (
    select 1 from public.group_memberships gm
     where gm.group_id = v_group_id and gm.user_id = new.user_id
  ) then
    raise exception 'meetup not found' using errcode = 'AL001';
  end if;

  if v_status = 'cancelled' then
    raise exception 'meetup is cancelled' using errcode = 'AL002';
  end if;

  if v_starts_at <= now() then
    raise exception 'meetup has already started' using errcode = 'AL003';
  end if;

  return new;
end;
$$;

create trigger rsvps_guard_insert
  before insert on public.rsvps
  for each row execute function app.guard_rsvp_insert();

revoke all on function app.approximate_area(double precision, double precision) from public;
revoke all on function app.insert_meetup(uuid, uuid, text, timestamptz, text, double precision, double precision, uuid) from public;
revoke all on function app.guard_meetup_update() from public;
revoke all on function app.guard_rsvp_insert() from public;
