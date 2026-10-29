/**
 * Bonus work sample: who may join the private live-walk channel.
 * Realtime evaluates RLS on realtime.messages with realtime.topic() set to
 * the channel; these tests do the same on the real migrations.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { meetups, users, type Persona } from '../support/fixtures';
import { readSql, referenceMeetupsSeedPath } from '../support/paths';
import { createSeededPglite } from '../support/pglite-db';

let db: PGlite;

beforeAll(async () => {
  db = await createSeededPglite();
});
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec(readSql(referenceMeetupsSeedPath));
  await db.exec(`delete from realtime.messages`);
});

const topic = (meetupId: string) => `meetup:${meetupId}:live`;

/** Can `persona` receive (select) and send (insert) on `channel`? Always rolled back. */
async function access(persona: Persona, channel: string) {
  await db.query(
    `insert into realtime.messages (topic, extension, event, payload) values ($1, 'broadcast', 'position', '{}')`,
    [channel],
  );
  const result = await db.transaction(async (tx) => {
    await tx.query(`set local role authenticated`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify({ sub: users[persona], role: 'authenticated' }),
    ]);
    await tx.query(`select set_config('realtime.topic', $1, true)`, [channel]);
    const receive = await tx.query<{ n: number }>(
      `select count(*)::int as n from realtime.messages`,
    );
    let send = true;
    try {
      await tx.query(
        `insert into realtime.messages (topic, extension, event, payload) values ($1, 'broadcast', 'position', '{}')`,
        [channel],
      );
    } catch (error) {
      expect((error as { code?: string }).code).toBe('42501');
      send = false;
    }
    await tx.rollback();
    return { receive: (receive.rows[0]?.n ?? 0) > 0, send };
  });
  await db.exec(`delete from realtime.messages`);
  return result;
}

describe('live walk channel authorization', () => {
  it.each<[Persona, boolean, string]>([
    ['avery', true, 'creator'],
    ['jordan', true, 'attendee'],
    ['riley', true, 'attendee (multi-group)'],
    ['sam', false, 'member without RSVP'],
    ['quinn', false, 'member of the other group'],
    ['taylor', false, 'outsider'],
  ])('%s allowed=%s (%s)', async (persona, allowed) => {
    expect(await access(persona, topic(meetups.saturdayLoop))).toEqual({
      receive: allowed,
      send: allowed,
    });
  });

  it('an RSVP to one meetup does not open another meetup’s channel', async () => {
    expect(await access('riley', topic(meetups.weeknightWalk))).toEqual({
      receive: false,
      send: false,
    });
  });

  it('closes when the meetup is cancelled, even for the creator', async () => {
    await db.query(`update public.meetups set status = 'cancelled' where id = $1`, [
      meetups.saturdayLoop,
    ]);
    expect(await access('avery', topic(meetups.saturdayLoop))).toEqual({
      receive: false,
      send: false,
    });
  });

  it.each([
    'meetup:not-a-uuid:live',
    `meetup:${meetups.saturdayLoop}:live:extra`,
    `MEETUP:${meetups.saturdayLoop}:LIVE`,
    `realtime:public:meetups`,
  ])('rejects a malformed or foreign topic: %s', async (channel) => {
    expect(await access('avery', channel)).toEqual({ receive: false, send: false });
  });
});
