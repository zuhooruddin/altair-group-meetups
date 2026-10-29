-- =====================================================================
-- Access control: grants + row-level security for the meetup slice.
--
-- Two database roles act on behalf of a signed-in member:
--
--   authenticated       Supabase's role for requests carrying a member's
--                       JWT (the app, or the API server's read path).
--                       READ ONLY in this slice: no INSERT/UPDATE/DELETE
--                       grant on any table, so a write sent from the app
--                       straight to PostgREST is refused by the database.
--
--   altair_api_writer   NOLOGIN role that only the API server can assume
--                       (SET LOCAL ROLE inside a transaction, after it has
--                       verified the member's JWT and validated the body
--                       with the shared Zod schemas). PostgREST cannot
--                       switch to it: it is not granted to `authenticator`.
--                       It holds the minimum write grants, and RLS still
--                       applies to it as the member (creator-only cancel,
--                       own-RSVP-only, members-only create).
--
-- The member's identity comes from the `sub` claim of request.jwt.claims,
-- which PostgREST sets for `authenticated` and the API server sets for
-- `altair_api_writer` from the verified token (transaction-local, so a
-- pooled connection never carries one member's identity into the next
-- request). app.current_user_id() is equivalent to auth.uid(); it lives in
-- `app` so the writer role needs no privileges on Supabase's `auth` schema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Writer role
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'altair_api_writer') then
    create role altair_api_writer nologin noinherit;
  end if;
end
$$;

comment on role altair_api_writer is
  'Assumed only by the ALTAIR API server (SET LOCAL ROLE) for validated writes. Not reachable via PostgREST.';

-- The migration runs as the database owner (postgres), which is also the
-- role the API server connects as; it must be able to SET ROLE to the writer.
grant altair_api_writer to current_user;

grant usage on schema public to altair_api_writer;
grant usage on schema app to authenticated, altair_api_writer;

-- ---------------------------------------------------------------------
-- Identity + membership helpers
-- SECURITY DEFINER predicates read group_memberships without recursing
-- into its own RLS. Each answers a yes/no question about the caller only.
-- ---------------------------------------------------------------------
create function app.current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

comment on function app.current_user_id() is
  'Caller id from request.jwt.claims (set by PostgREST, or SET LOCAL by the API server). NULL when absent.';

create function app.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_memberships gm
     where gm.group_id = p_group_id
       and gm.user_id  = app.current_user_id()
  )
$$;

create function app.is_meetup_member(p_meetup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.meetups m
      join public.group_memberships gm on gm.group_id = m.group_id
     where m.id = p_meetup_id
       and gm.user_id = app.current_user_id()
  )
$$;

-- Creator or attendee, AND still a member of the meetup's group.
-- An RSVP grants exact access to that one meetup only.
create function app.can_see_exact_meeting_point(p_meetup_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.meetups m
      join public.group_memberships gm
        on gm.group_id = m.group_id and gm.user_id = app.current_user_id()
     where m.id = p_meetup_id
       and (
         m.created_by = app.current_user_id()
         or exists (
           select 1 from public.rsvps r
            where r.meetup_id = m.id and r.user_id = app.current_user_id()
         )
       )
  )
$$;

create function app.shares_group_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.group_memberships mine
      join public.group_memberships theirs on theirs.group_id = mine.group_id
     where mine.user_id   = app.current_user_id()
       and theirs.user_id = p_user_id
  )
$$;

revoke all on function app.current_user_id() from public;
revoke all on function app.is_group_member(uuid) from public;
revoke all on function app.is_meetup_member(uuid) from public;
revoke all on function app.can_see_exact_meeting_point(uuid) from public;
revoke all on function app.shares_group_with(uuid) from public;

grant execute on function app.current_user_id()                   to authenticated, altair_api_writer;
grant execute on function app.is_group_member(uuid)               to authenticated, altair_api_writer;
grant execute on function app.is_meetup_member(uuid)              to authenticated, altair_api_writer;
grant execute on function app.can_see_exact_meeting_point(uuid)   to authenticated, altair_api_writer;
grant execute on function app.shares_group_with(uuid)             to authenticated, altair_api_writer;

grant execute on function app.approximate_area(double precision, double precision) to altair_api_writer;
grant execute on function app.insert_meetup(uuid, uuid, text, timestamptz, text, double precision, double precision, uuid)
  to altair_api_writer;

-- ---------------------------------------------------------------------
-- Table privileges. Supabase's default privileges grant ALL on new public
-- tables to anon and authenticated; start from nothing and add back only
-- what this slice needs. anon gets nothing at all.
-- ---------------------------------------------------------------------
revoke all on table public.users                 from anon, authenticated;
revoke all on table public.groups                from anon, authenticated;
revoke all on table public.group_memberships     from anon, authenticated;
revoke all on table public.meetups               from anon, authenticated;
revoke all on table public.meetup_meeting_points from anon, authenticated;
revoke all on table public.rsvps                 from anon, authenticated;

-- users: COLUMN-level grant. home_lat / home_lng are not granted to any
-- client-facing role, so `select home_lat ...` (or `select *`) fails with
-- "permission denied" no matter which rows RLS would allow.
grant select (id, display_name) on table public.users to authenticated, altair_api_writer;

grant select on table public.groups                to authenticated, altair_api_writer;
grant select on table public.group_memberships     to authenticated, altair_api_writer;
grant select on table public.meetups               to authenticated, altair_api_writer;
grant select on table public.meetup_meeting_points to authenticated, altair_api_writer;
grant select on table public.rsvps                 to authenticated, altair_api_writer;

-- Writer: create meetups (+ exact point), cancel (status only), RSVP, withdraw.
grant insert                       on table public.meetups               to altair_api_writer;
grant update (status, cancelled_at) on table public.meetups              to altair_api_writer;
grant insert                       on table public.meetup_meeting_points to altair_api_writer;
grant insert, delete               on table public.rsvps                 to altair_api_writer;

-- ---------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------

-- users: yourself, and members of a group you share (attendee names).
create policy users_select_self_or_groupmates on public.users
  for select to authenticated, altair_api_writer
  using (id = (select app.current_user_id()) or app.shares_group_with(id));

-- groups: only groups you belong to ("my groups").
create policy groups_select_member on public.groups
  for select to authenticated, altair_api_writer
  using (app.is_group_member(id));

-- group_memberships: only your own rows.
create policy group_memberships_select_own on public.group_memberships
  for select to authenticated, altair_api_writer
  using (user_id = (select app.current_user_id()));

-- meetups: members of the group read (including cancelled ones).
create policy meetups_select_member on public.meetups
  for select to authenticated, altair_api_writer
  using (app.is_group_member(group_id));

-- meetups: a member creates in their own group, as themselves, scheduled,
-- starting in the future.
create policy meetups_insert_member on public.meetups
  for insert to altair_api_writer
  with check (
    created_by = (select app.current_user_id())
    and app.is_group_member(group_id)
    and status = 'scheduled'
    and cancelled_at is null
    and starts_at > now()
  );

-- meetups: only the creator updates (cancel). Column grant limits the
-- writer to status/cancelled_at; the trigger makes cancellation final.
create policy meetups_update_creator on public.meetups
  for update to altair_api_writer
  using (created_by = (select app.current_user_id()) and app.is_group_member(group_id))
  with check (created_by = (select app.current_user_id()));

-- meetup_meeting_points: creator and attendees only.
create policy meeting_points_select_creator_or_attendee on public.meetup_meeting_points
  for select to authenticated, altair_api_writer
  using (app.can_see_exact_meeting_point(meetup_id));

create policy meeting_points_insert_creator on public.meetup_meeting_points
  for insert to altair_api_writer
  with check (
    exists (
      select 1 from public.meetups m
       where m.id = meetup_id and m.created_by = (select app.current_user_id())
    )
  );

-- rsvps: members of the meetup's group see the attendee list.
create policy rsvps_select_member on public.rsvps
  for select to authenticated, altair_api_writer
  using (app.is_meetup_member(meetup_id));

-- rsvps: only for yourself, only in your own group.
create policy rsvps_insert_self on public.rsvps
  for insert to altair_api_writer
  with check (user_id = (select app.current_user_id()) and app.is_meetup_member(meetup_id));

-- rsvps: withdraw only your own (allowed after cancellation too).
create policy rsvps_delete_self on public.rsvps
  for delete to altair_api_writer
  using (user_id = (select app.current_user_id()));
