-- =====================================================================
-- Meetups, exact meeting points, and RSVPs.
--
-- Design note: the exact meeting point (place name + coordinates) lives in
-- its own table, public.meetup_meeting_points, instead of on public.meetups.
-- Row-level security is per row, not per column, so splitting the table is
-- what lets RLS alone decide who may read the exact spot. public.meetups
-- only carries the approximate area (a randomly offset circle computed once
-- in the database, see the next migration), which every group member may see.
-- =====================================================================

-- Private schema for helpers. It is not in the Data API's exposed schemas,
-- so nothing here is callable over PostgREST.
create schema if not exists app;
comment on schema app is
  'Private helpers for the meetup slice. Not exposed through the Supabase Data API.';
revoke all on schema app from public;

-- ---------------------------------------------------------------------
-- meetups
-- ---------------------------------------------------------------------
create table public.meetups (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups (id) on delete cascade,
  created_by       uuid not null references public.users (id) on delete cascade,
  title            text not null
                   check (title = btrim(title) and char_length(title) between 1 and 80),
  starts_at        timestamptz not null,
  status           text not null default 'scheduled'
                   check (status in ('scheduled', 'cancelled')),
  cancelled_at     timestamptz,

  -- Approximate area shown to members who have not RSVP'd. Never the exact
  -- point: the center is offset from it (see app.approximate_area).
  area_center_lat  double precision not null check (area_center_lat between -90 and 90),
  area_center_lng  double precision not null check (area_center_lng between -180 and 180),
  area_radius_m    integer not null check (area_radius_m >= 300),

  created_at       timestamptz not null default now(),

  constraint meetups_cancelled_at_matches_status
    check ((status = 'cancelled') = (cancelled_at is not null))
);

comment on table public.meetups is
  'Group meetups. Exact meeting point is in meetup_meeting_points (RLS: creator and attendees only).';

-- List query: a group's meetups ordered by start time.
create index meetups_group_id_starts_at_idx on public.meetups (group_id, starts_at);
create index meetups_created_by_idx on public.meetups (created_by);

-- ---------------------------------------------------------------------
-- meetup_meeting_points: the EXACT meeting point, one row per meetup
-- ---------------------------------------------------------------------
create table public.meetup_meeting_points (
  meetup_id   uuid primary key references public.meetups (id) on delete cascade,
  place_name  text not null
              check (place_name = btrim(place_name) and char_length(place_name) between 1 and 120),
  latitude    double precision not null check (latitude between -90 and 90),
  longitude   double precision not null check (longitude between -180 and 180)
);

comment on table public.meetup_meeting_points is
  'EXACT meeting point. Readable only by the meetup creator and members who have RSVP''d.';

-- ---------------------------------------------------------------------
-- rsvps: one per member per meetup
-- ---------------------------------------------------------------------
create table public.rsvps (
  meetup_id   uuid not null references public.meetups (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (meetup_id, user_id)
);

create index rsvps_user_id_idx on public.rsvps (user_id);

alter table public.meetups               enable row level security;
alter table public.meetup_meeting_points enable row level security;
alter table public.rsvps                 enable row level security;
