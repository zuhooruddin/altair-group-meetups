/**
 * Hosted-only: what a signed-in member could do by skipping our API and
 * talking to Supabase directly (Auth + the Data API / PostgREST), plus a
 * real two-connection race between an RSVP and a cancel.
 */
import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  emails,
  exactPoints,
  FIXTURE_PASSWORD,
  groups,
  meetups,
  TEST_TITLE_PREFIX,
  users,
} from '../support/fixtures';
import { anonClient, clientAs, hostedEnv } from '../support/hosted-env';
import { expectNoHomeLocation } from '../support/leaks';
import { readSql, referenceMeetupsSeedPath } from '../support/paths';

let owner: pg.Pool;

beforeAll(() => {
  owner = new pg.Pool({ connectionString: hostedEnv().DATABASE_URL, max: 3 });
});

afterAll(async () => {
  await owner.query(`delete from public.meetups where title like '${TEST_TITLE_PREFIX}%'`);
  await owner.query(readSql(referenceMeetupsSeedPath));
  await owner.end();
});

beforeEach(async () => {
  await owner.query(`delete from public.meetups where title like '${TEST_TITLE_PREFIX}%'`);
  await owner.query(readSql(referenceMeetupsSeedPath));
});

describe('Supabase Auth with the seed accounts', () => {
  it('signs in with the fixture password', async () => {
    const { data, error } = await anonClient().auth.signInWithPassword({
      email: emails.sam,
      password: FIXTURE_PASSWORD,
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toEqual(expect.any(String));
    expect(data.user?.id).toBe(users.sam);
  });

  it('rejects a wrong password and an unknown account', async () => {
    const wrong = await anonClient().auth.signInWithPassword({
      email: emails.sam,
      password: 'not-the-password',
    });
    expect(wrong.error).not.toBeNull();
    expect(wrong.data.session).toBeNull();
    const unknown = await anonClient().auth.signInWithPassword({
      email: 'nobody@example.test',
      password: FIXTURE_PASSWORD,
    });
    expect(unknown.error).not.toBeNull();
  });
});

describe('direct Data API reads are bound by RLS', () => {
  it('outsider reads nothing: meetups, attendees, meeting points, groups', async () => {
    const taylor = await clientAs('taylor');
    for (const table of [
      'meetups',
      'rsvps',
      'meetup_meeting_points',
      'groups',
      'group_memberships',
    ]) {
      const { data, error } = await taylor.from(table).select('*');
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it('anonymous requests are refused', async () => {
    const { data, error } = await anonClient().from('meetups').select('id');
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe('42501');
  });

  it('member without RSVP gets no exact meeting points; the meetups row has only the area', async () => {
    const sam = await clientAs('sam');
    const points = await sam.from('meetup_meeting_points').select('*');
    expect(points.error).toBeNull();
    expect(points.data).toEqual([]);
    const rows = await sam.from('meetups').select('*').eq('id', meetups.saturdayLoop);
    expect(rows.data).toHaveLength(1);
    const text = JSON.stringify(rows.data);
    expect(text).not.toContain(exactPoints.saturdayLoop.placeName);
    expect(text).not.toContain(String(exactPoints.saturdayLoop.latitude));
  });

  it('multi-group member gets exactly the points they RSVPd to', async () => {
    const riley = await clientAs('riley');
    const { data } = await riley.from('meetup_meeting_points').select('meetup_id');
    expect(data?.map((r) => r.meetup_id)).toEqual([meetups.saturdayLoop]);
  });

  it('home location cannot be selected, and select=* on users is refused', async () => {
    const sam = await clientAs('sam');
    for (const columns of ['home_lat', 'home_lng', '*']) {
      const { data, error } = await sam.from('users').select(columns);
      expect(error?.code, columns).toBe('42501');
      expect(data).toBeNull();
    }
    const safe = await sam.from('users').select('id, display_name');
    expect(safe.error).toBeNull();
    expectNoHomeLocation(safe.data);
  });
});

describe('direct Data API writes are impossible (writes must go through the API)', () => {
  it('cannot insert a meetup', async () => {
    const sam = await clientAs('sam');
    const { error } = await sam.from('meetups').insert({
      group_id: groups.maple,
      created_by: users.sam,
      title: `${TEST_TITLE_PREFIX} direct`,
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      area_center_lat: 40,
      area_center_lng: -100,
      area_radius_m: 400,
    });
    expect(error?.code).toBe('42501');
  });

  it('creator cannot cancel directly', async () => {
    const avery = await clientAs('avery');
    const { error } = await avery
      .from('meetups')
      .update({ status: 'cancelled' })
      .eq('id', meetups.saturdayLoop);
    expect(error?.code).toBe('42501');
    const { rows } = await owner.query(`select status from public.meetups where id = $1`, [
      meetups.saturdayLoop,
    ]);
    expect(rows[0].status).toBe('scheduled');
  });

  it('cannot RSVP or withdraw directly', async () => {
    const sam = await clientAs('sam');
    const insert = await sam
      .from('rsvps')
      .insert({ meetup_id: meetups.weeknightWalk, user_id: users.sam });
    expect(insert.error?.code).toBe('42501');
    const jordan = await clientAs('jordan');
    const remove = await jordan.from('rsvps').delete().eq('meetup_id', meetups.saturdayLoop);
    expect(remove.error?.code).toBe('42501');
  });

  it('private app.* functions are not reachable over the Data API', async () => {
    const sam = await clientAs('sam');
    const viaSchema = await sam.schema('app').rpc('insert_meetup', {
      p_group_id: groups.maple,
      p_created_by: users.sam,
      p_title: `${TEST_TITLE_PREFIX} rpc`,
      p_starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_place_name: 'x',
      p_latitude: 40,
      p_longitude: -100,
    });
    expect(viaSchema.error).not.toBeNull();
    const viaPublic = await sam.rpc('insert_meetup', {});
    expect(viaPublic.error).not.toBeNull();
    const { rows } = await owner.query(
      `select count(*)::int as n from public.meetups where title like $1`,
      [`${TEST_TITLE_PREFIX}%`],
    );
    expect(rows[0].n).toBe(0);
  });
});

describe('concurrency: RSVP racing a cancel', () => {
  it('an RSVP blocked behind an uncommitted cancel is rejected once the cancel commits', async () => {
    const asMember = async (client: pg.PoolClient, userId: string) => {
      await client.query('begin');
      await client.query('set local role altair_api_writer');
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: userId }),
      ]);
    };
    const creator = await owner.connect();
    const attendee = await owner.connect();
    try {
      await asMember(creator, users.jordan);
      await creator.query(`update public.meetups set status = 'cancelled' where id = $1`, [
        meetups.weeknightWalk,
      ]);

      await asMember(attendee, users.sam);
      const rsvp = attendee
        .query(`insert into public.rsvps (meetup_id, user_id) values ($1, app.current_user_id())`, [
          meetups.weeknightWalk,
        ])
        .then(
          () => 'inserted',
          (e: { code?: string }) => e.code,
        );

      await new Promise((r) => setTimeout(r, 300)); // the RSVP is now waiting on the row lock
      await creator.query('commit');
      expect(await rsvp).toBe('AL002');
      await attendee.query('rollback');
    } finally {
      creator.release();
      attendee.release();
    }
    const { rows } = await owner.query(
      `select count(*)::int as n from public.rsvps where meetup_id = $1`,
      [meetups.weeknightWalk],
    );
    expect(rows[0].n).toBe(0);
  });
});
