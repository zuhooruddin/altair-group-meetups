/**
 * Database-level access tests on the real migrations (embedded Postgres 17).
 *
 * Each query runs inside a transaction as the role PostgREST would use for a
 * signed-in member (`authenticated`), with the member's id in
 * request.jwt.claims — i.e. exactly what the app could do by talking to the
 * Data API directly, bypassing our server. The hosted suite repeats the key
 * cases through real PostgREST.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { exactPoints, groups, meetups, users, type Persona } from '../support/fixtures';
import { distanceMeters } from '../support/leaks';
import { createSeededPglite } from '../support/pglite-db';
import { readSql, referenceMeetupsSeedPath } from '../support/paths';

let db: PGlite;

beforeAll(async () => {
  db = await createSeededPglite();
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`delete from public.meetups where title like '[test]%'`);
  await db.exec(readSql(referenceMeetupsSeedPath));
});

type Role = 'authenticated' | 'altair_api_writer' | 'anon';

/** Runs `sql` as `role` for `persona`, always rolled back. Returns rows or the SQLSTATE. */
async function as<T = Record<string, unknown>>(
  persona: Persona | null,
  role: Role,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows: T[]; affected: number; error?: string }> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${role}`);
    if (persona) {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: users[persona], role: 'authenticated' }),
      ]);
    }
    try {
      const result = await tx.query<T>(sql, params as never[]);
      await tx.rollback();
      return { rows: result.rows, affected: result.affectedRows ?? 0 };
    } catch (error) {
      await tx.rollback();
      return { rows: [], affected: 0, error: (error as { code?: string }).code ?? String(error) };
    }
  });
}

const asMember = <T = Record<string, unknown>>(p: Persona, sql: string, params: unknown[] = []) =>
  as<T>(p, 'authenticated', sql, params);
const asWriter = <T = Record<string, unknown>>(p: Persona, sql: string, params: unknown[] = []) =>
  as<T>(p, 'altair_api_writer', sql, params);

describe('migrations + seed', () => {
  it('loads the seed cast and the three reference meetups with their RSVPs', async () => {
    const counts = await db.query<{
      users: number;
      memberships: number;
      meetups: number;
      points: number;
      rsvps: number;
    }>(`
      select (select count(*)::int from public.users) as users,
             (select count(*)::int from public.group_memberships) as memberships,
             (select count(*)::int from public.meetups) as meetups,
             (select count(*)::int from public.meetup_meeting_points) as points,
             (select count(*)::int from public.rsvps) as rsvps`);
    expect(counts.rows[0]).toEqual({ users: 8, memberships: 8, meetups: 3, points: 3, rsvps: 3 });
  });
});

describe('outsider (Taylor) reads nothing', () => {
  it.each([
    ['meetups', 'select id from public.meetups'],
    ['meeting points', 'select meetup_id from public.meetup_meeting_points'],
    ['rsvps / attendees', 'select meetup_id from public.rsvps'],
    ['groups', 'select id from public.groups'],
    ['memberships', 'select group_id from public.group_memberships'],
  ])('%s: zero rows', async (_label, sql) => {
    const result = await asMember('taylor', sql);
    expect(result.error).toBeUndefined();
    expect(result.rows).toEqual([]);
  });

  it('sees only their own profile row', async () => {
    const result = await asMember<{ id: string }>(
      'taylor',
      'select id, display_name from public.users',
    );
    expect(result.rows.map((r) => r.id)).toEqual([users.taylor]);
  });
});

describe('anonymous access', () => {
  it.each([
    'public.meetups',
    'public.rsvps',
    'public.meetup_meeting_points',
    'public.users',
    'public.groups',
  ])('anon has no privilege on %s', async (table) => {
    const result = await as(null, 'anon', `select 1 from ${table}`);
    expect(result.error).toBe('42501');
  });
});

describe('home location is never readable', () => {
  it.each([
    'select home_lat from public.users',
    'select home_lng from public.users',
    'select * from public.users',
  ])('%s -> permission denied, even for your own row', async (sql) => {
    const result = await asMember('sam', sql);
    expect(result.error).toBe('42501');
  });

  it('writer role cannot read it either', async () => {
    expect((await asWriter('sam', 'select home_lat from public.users')).error).toBe('42501');
  });

  it('groupmates are visible by id and display name only', async () => {
    const result = await asMember<{ display_name: string }>(
      'sam',
      'select id, display_name from public.users order by display_name',
    );
    expect(result.rows.map((r) => r.display_name)).toEqual([
      'Avery Lin',
      'Jordan Price',
      'Riley Chen',
      'Sam Okafor',
    ]);
  });
});

describe('members read their group, cancelled included', () => {
  it('Sam (Maple) sees both Maple meetups and none from Riverside', async () => {
    const result = await asMember<{ id: string }>(
      'sam',
      'select id from public.meetups order by starts_at',
    );
    expect(result.rows.map((r) => r.id)).toEqual([meetups.saturdayLoop, meetups.weeknightWalk]);
  });

  it('Sam sees the attendee list of a Maple meetup', async () => {
    const result = await asMember<{ user_id: string }>(
      'sam',
      'select user_id from public.rsvps where meetup_id = $1 order by user_id',
      [meetups.saturdayLoop],
    );
    expect(result.rows.map((r) => r.user_id)).toEqual([users.jordan, users.riley]);
  });

  it('Quinn (Riverside only) cannot see Maple attendees', async () => {
    const result = await asMember(
      'quinn',
      'select user_id from public.rsvps where meetup_id = $1',
      [meetups.saturdayLoop],
    );
    expect(result.rows).toEqual([]);
  });
});

describe('exact meeting point: creator and attendees only, per meetup', () => {
  const visiblePoints = async (p: Persona) =>
    (
      await asMember<{ meetup_id: string }>(
        p,
        'select meetup_id from public.meetup_meeting_points order by meetup_id',
      )
    ).rows.map((r) => r.meetup_id);

  it('member without RSVP (Sam): none', async () => {
    expect(await visiblePoints('sam')).toEqual([]);
  });

  it('attendee (Jordan RSVPd Saturday) + creator of Weeknight: both, nothing from Riverside', async () => {
    expect(await visiblePoints('jordan')).toEqual([meetups.saturdayLoop, meetups.weeknightWalk]);
  });

  it('creator (Avery): own meetup only', async () => {
    expect(await visiblePoints('avery')).toEqual([meetups.saturdayLoop]);
  });

  it('multi-group member (Riley): Saturday (RSVPd) only; not Weeknight, not Riverside sunrise', async () => {
    expect(await visiblePoints('riley')).toEqual([meetups.saturdayLoop]);
  });

  it('Riverside: Morgan (creator) and Casey (attendee) yes, Quinn no', async () => {
    expect(await visiblePoints('morgan')).toEqual([meetups.riversideSunrise]);
    expect(await visiblePoints('casey')).toEqual([meetups.riversideSunrise]);
    expect(await visiblePoints('quinn')).toEqual([]);
  });
});

describe('approximate area', () => {
  it('stored areas: radius >= 300 m, center 120-280 m from the exact point (so exact is inside)', async () => {
    const { rows } = await db.query<{
      id: string;
      area_center_lat: number;
      area_center_lng: number;
      area_radius_m: number;
      latitude: number;
      longitude: number;
    }>(
      `select m.id, m.area_center_lat, m.area_center_lng, m.area_radius_m, p.latitude, p.longitude
         from public.meetups m join public.meetup_meeting_points p on p.meetup_id = m.id`,
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const d = distanceMeters(
        { latitude: row.area_center_lat, longitude: row.area_center_lng },
        { latitude: row.latitude, longitude: row.longitude },
      );
      expect(row.area_radius_m).toBeGreaterThanOrEqual(300);
      expect(d).toBeGreaterThanOrEqual(119);
      expect(d).toBeLessThanOrEqual(281);
      expect(d).toBeLessThan(row.area_radius_m);
    }
  });

  it('offset is random per call (no shared offset to learn from one RSVP)', async () => {
    const { rows } = await db.query<{ center_lat: number; center_lng: number; radius_m: number }>(
      `select (a).* from (select app.approximate_area(40.012046, -99.984517) as a from generate_series(1, 300)) s`,
    );
    const p = exactPoints.saturdayLoop;
    const distances = rows.map((r) =>
      distanceMeters({ latitude: r.center_lat, longitude: r.center_lng }, p),
    );
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(119);
    expect(Math.max(...distances)).toBeLessThanOrEqual(281);
    expect(new Set(rows.map((r) => `${r.center_lat},${r.center_lng}`)).size).toBe(rows.length);
    expect(rows.every((r) => r.radius_m === 400)).toBe(true);
  });
});

describe('the app cannot write directly (only the API server can)', () => {
  it.each([
    [
      'insert meetup',
      `insert into public.meetups (group_id, created_by, title, starts_at, area_center_lat, area_center_lng, area_radius_m)
                       values ('${groups.maple}', '${users.sam}', 'x', now() + interval '1 day', 40, -100, 400)`,
    ],
    [
      'cancel meetup',
      `update public.meetups set status = 'cancelled' where id = '${meetups.saturdayLoop}'`,
    ],
    [
      'insert rsvp',
      `insert into public.rsvps (meetup_id, user_id) values ('${meetups.weeknightWalk}', '${users.sam}')`,
    ],
    ['delete rsvp', `delete from public.rsvps where meetup_id = '${meetups.saturdayLoop}'`],
    [
      'call insert_meetup',
      `select app.insert_meetup('${groups.maple}', '${users.sam}', 'x', now() + interval '1 day', 'p', 40, -100)`,
    ],
  ])('authenticated: %s -> permission denied', async (_label, sql) => {
    const result = await asMember('avery', sql);
    expect(result.error).toBe('42501');
  });
});

describe('writer role still enforces the member rules (RLS)', () => {
  it('non-creator cannot cancel (0 rows changed)', async () => {
    const result = await asWriter(
      'jordan',
      `update public.meetups set status = 'cancelled' where id = $1`,
      [meetups.saturdayLoop],
    );
    expect(result.error).toBeUndefined();
    expect(result.affected).toBe(0);
  });

  it('outsider cannot cancel (0 rows changed)', async () => {
    const result = await asWriter(
      'taylor',
      `update public.meetups set status = 'cancelled' where id = $1`,
      [meetups.saturdayLoop],
    );
    expect(result.affected).toBe(0);
  });

  it('creator can cancel', async () => {
    const result = await asWriter(
      'avery',
      `update public.meetups set status = 'cancelled' where id = $1`,
      [meetups.saturdayLoop],
    );
    expect(result.error).toBeUndefined();
    expect(result.affected).toBe(1);
  });

  // Title/start time became writable for the creator with the edit bonus
  // (see "bonus: editing a meetup"); creator and group never are.
  it('writer cannot change the creator or the group (column grants)', async () => {
    expect(
      (
        await asWriter('avery', `update public.meetups set group_id = $2 where id = $1`, [
          meetups.saturdayLoop,
          groups.riverside,
        ])
      ).error,
    ).toBe('42501');
    expect(
      (
        await asWriter('avery', `update public.meetups set created_by = $2 where id = $1`, [
          meetups.saturdayLoop,
          users.sam,
        ])
      ).error,
    ).toBe('42501');
  });

  it("cannot withdraw someone else's RSVP (0 rows)", async () => {
    const result = await asWriter(
      'sam',
      `delete from public.rsvps where meetup_id = $1 and user_id = $2`,
      [meetups.saturdayLoop, users.jordan],
    );
    expect(result.affected).toBe(0);
  });

  it('cannot RSVP on behalf of someone else', async () => {
    const result = await asWriter(
      'jordan',
      `insert into public.rsvps (meetup_id, user_id) values ($1, $2)`,
      [meetups.weeknightWalk, users.sam],
    );
    expect(result.error).toBe('42501');
  });

  it('outsider RSVP is rejected as not found (no status leak)', async () => {
    const result = await asWriter(
      'taylor',
      `insert into public.rsvps (meetup_id, user_id) values ($1, $2)`,
      [meetups.saturdayLoop, users.taylor],
    );
    expect(result.error).toBe('AL001');
  });

  it('cannot create a meetup as someone else, or in a group you are not in', async () => {
    const asOther = await asWriter(
      'sam',
      `select app.insert_meetup($1, $2, '[test] x', now() + interval '1 day', 'p', 40, -100)`,
      [groups.maple, users.avery],
    );
    expect(asOther.error).toBe('42501');
    const otherGroup = await asWriter(
      'sam',
      `select app.insert_meetup($1, $2, '[test] x', now() + interval '1 day', 'p', 40, -100)`,
      [groups.riverside, users.sam],
    );
    expect(otherGroup.error).toBe('42501');
  });

  it('rejects a start time that is not in the future', async () => {
    const result = await asWriter(
      'sam',
      `select app.insert_meetup($1, $2, '[test] x', now(), 'p', 40, -100)`,
      [groups.maple, users.sam],
    );
    expect(result.error).toBe('AL006');
  });

  it('member can create in their own group', async () => {
    const result = await asWriter<{ id: string }>(
      'sam',
      `select app.insert_meetup($1, $2, '[test] ok', now() + interval '1 day', 'p', 40, -100) as id`,
      [groups.maple, users.sam],
    );
    expect(result.error).toBeUndefined();
    expect(result.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('domain rules hold even for the database owner', () => {
  it('a cancelled meetup cannot be reopened or edited', async () => {
    await db.query(`update public.meetups set status = 'cancelled' where id = $1`, [
      meetups.weeknightWalk,
    ]);
    await expect(
      db.query(
        `update public.meetups set status = 'scheduled', cancelled_at = null where id = $1`,
        [meetups.weeknightWalk],
      ),
    ).rejects.toMatchObject({
      code: 'AL004',
    });
  });

  it('no RSVP to a cancelled meetup', async () => {
    await db.query(`update public.meetups set status = 'cancelled' where id = $1`, [
      meetups.weeknightWalk,
    ]);
    await expect(
      db.query(`insert into public.rsvps (meetup_id, user_id) values ($1, $2)`, [
        meetups.weeknightWalk,
        users.sam,
      ]),
    ).rejects.toMatchObject({ code: 'AL002' });
  });

  it('no RSVP to a started meetup', async () => {
    await db.query(
      `update public.meetups set starts_at = now() - interval '5 minutes' where id = $1`,
      [meetups.weeknightWalk],
    );
    await expect(
      db.query(`insert into public.rsvps (meetup_id, user_id) values ($1, $2)`, [
        meetups.weeknightWalk,
        users.sam,
      ]),
    ).rejects.toMatchObject({ code: 'AL003' });
  });

  it('RSVP user must be a member of the group', async () => {
    await expect(
      db.query(`insert into public.rsvps (meetup_id, user_id) values ($1, $2)`, [
        meetups.saturdayLoop,
        users.quinn,
      ]),
    ).rejects.toMatchObject({ code: 'AL001' });
  });

  it('existing attendees can still withdraw after cancellation', async () => {
    await db.query(`update public.meetups set status = 'cancelled' where id = $1`, [
      meetups.saturdayLoop,
    ]);
    const result = await asWriter(
      'jordan',
      `delete from public.rsvps where meetup_id = $1 and user_id = app.current_user_id()`,
      [meetups.saturdayLoop],
    );
    expect(result.error).toBeUndefined();
    expect(result.affected).toBe(1);
  });

  it('identity columns are immutable', async () => {
    await expect(
      db.query(`update public.meetups set group_id = $2 where id = $1`, [
        meetups.saturdayLoop,
        groups.riverside,
      ]),
    ).rejects.toMatchObject({
      code: 'AL005',
    });
  });
});

describe('bonus: editing a meetup', () => {
  const setTitle = `update public.meetups set title = '[test] renamed' where id = $1`;
  const movePoint = `update public.meetup_meeting_points
                        set place_name = 'Fountain plaza, Town Green', latitude = 39.999134, longitude = -99.999461
                      where meetup_id = $1`;

  it('creator can change title, start time and meeting point', async () => {
    expect((await asWriter('avery', setTitle, [meetups.saturdayLoop])).affected).toBe(1);
    const start = await asWriter(
      'avery',
      `update public.meetups set starts_at = now() + interval '3 days' where id = $1`,
      [meetups.saturdayLoop],
    );
    expect(start.error).toBeUndefined();
    expect(start.affected).toBe(1);
    expect((await asWriter('avery', movePoint, [meetups.saturdayLoop])).affected).toBe(1);
  });

  it('other members and outsiders change nothing (RLS: 0 rows)', async () => {
    for (const persona of ['jordan', 'riley', 'sam', 'taylor', 'quinn'] as const) {
      expect((await asWriter(persona, setTitle, [meetups.saturdayLoop])).affected, persona).toBe(0);
      expect((await asWriter(persona, movePoint, [meetups.saturdayLoop])).affected, persona).toBe(
        0,
      );
    }
  });

  it('a changed start time must be in the future', async () => {
    const result = await asWriter(
      'avery',
      `update public.meetups set starts_at = now() - interval '1 hour' where id = $1`,
      [meetups.saturdayLoop],
    );
    expect(result.error).toBe('AL006');
  });

  it('a cancelled meetup cannot be edited (title or meeting point)', async () => {
    await db.query(`update public.meetups set status = 'cancelled' where id = $1`, [
      meetups.saturdayLoop,
    ]);
    expect((await asWriter('avery', setTitle, [meetups.saturdayLoop])).error).toBe('AL004');
    expect((await asWriter('avery', movePoint, [meetups.saturdayLoop])).error).toBe('AL004');
  });

  it('group, creator and area cannot be changed by a member write', async () => {
    for (const sql of [
      `update public.meetups set group_id = '${groups.riverside}' where id = $1`,
      `update public.meetups set created_by = '${users.sam}' where id = $1`,
      `update public.meetups set area_center_lat = 40.012046 where id = $1`,
    ]) {
      expect((await asWriter('avery', sql, [meetups.saturdayLoop])).error, sql).toBe('42501');
    }
  });

  it('the client-facing role cannot edit directly', async () => {
    expect((await asMember('avery', setTitle, [meetups.saturdayLoop])).error).toBe('42501');
    expect((await asMember('avery', movePoint, [meetups.saturdayLoop])).error).toBe('42501');
  });

  it('moving the meeting point recomputes the approximate area around the new spot', async () => {
    const area = async () =>
      (
        await db.query<{ lat: number; lng: number; r: number }>(
          `select area_center_lat as lat, area_center_lng as lng, area_radius_m as r
             from public.meetups where id = $1`,
          [meetups.saturdayLoop],
        )
      ).rows[0]!;
    const before = await area();
    await db.transaction(async (tx) => {
      await tx.query(`set local role altair_api_writer`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: users.avery }),
      ]);
      await tx.query(movePoint, [meetups.saturdayLoop]);
    });
    const after = await area();
    expect(after).not.toEqual(before);
    const d = distanceMeters(
      { latitude: after.lat, longitude: after.lng },
      { latitude: 39.999134, longitude: -99.999461 },
    );
    expect(d).toBeGreaterThanOrEqual(119);
    expect(d).toBeLessThan(after.r);
  });
});
