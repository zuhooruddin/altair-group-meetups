-- =====================================================================
-- Bonus work sample: authorization for the live walk Realtime channel.
--
-- Supabase Realtime Authorization checks RLS on realtime.messages when a
-- client joins a PRIVATE channel (select = receive, insert = send), with
-- realtime.topic() returning the channel name. Topic format:
--   meetup:<meetup uuid>:live
-- Live positions are as sensitive as the exact meeting point, so the
-- channel is open to exactly the people who may see that point (the
-- creator and attendees who are still members), and only while the meetup
-- is scheduled. Positions in the work sample are synthetic.
-- =====================================================================

create function app.live_walk_meetup_id(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^meetup:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:live$'
      then substring(p_topic from 8 for 36)::uuid
  end
$$;

create function app.can_join_live_walk(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    app.can_see_exact_meeting_point(app.live_walk_meetup_id(p_topic))
    and exists (
      select 1 from public.meetups m
       where m.id = app.live_walk_meetup_id(p_topic) and m.status = 'scheduled'
    ),
    false
  )
$$;

revoke all on function app.live_walk_meetup_id(text) from public;
revoke all on function app.can_join_live_walk(text) from public;
grant execute on function app.live_walk_meetup_id(text) to authenticated;
grant execute on function app.can_join_live_walk(text) to authenticated;

create policy live_walk_receive on realtime.messages
  for select to authenticated
  using (realtime.messages.extension = 'broadcast' and app.can_join_live_walk(realtime.topic()));

create policy live_walk_send on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and app.can_join_live_walk(realtime.topic()));
