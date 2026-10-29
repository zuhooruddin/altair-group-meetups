/**
 * The API access suite: the four roles from the brief (outsider, member
 * without RSVP, member with RSVP, creator), the multi-group member, and the
 * map data — through the real HTTP app, services, repositories and SQL.
 *
 * Registered by test/offline (embedded Postgres) and test/hosted (Supabase).
 */
import type { MeetupDetail, MeetupSummary } from '@altair/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  exactPoints,
  groups,
  meetups,
  SPARE_POINT,
  TEST_TITLE_PREFIX,
  users,
  type Persona,
} from './fixtures';
import type { ApiHarness } from './harness';
import { distanceMeters, expectNoExactPoint, expectNoHomeLocation } from './leaks';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export function describeApiAccess(environment: string, createHarness: () => Promise<ApiHarness>) {
  describe(`API access rules (${environment})`, () => {
    let h: ApiHarness;
    /** Every response body this suite receives, scanned for home locations at the end. */
    const seen: unknown[] = [];

    beforeAll(async () => {
      h = await createHarness();
    });

    afterAll(async () => {
      await h?.resetData();
      await h?.close();
    });

    beforeEach(async () => {
      await h.resetData();
    });

    async function call(
      persona: Persona | null,
      method: Method,
      url: string,
      payload?: unknown,
      headers: Record<string, string> = {},
    ) {
      const res = await h.app.inject({
        method,
        url,
        headers: {
          ...(persona ? { authorization: `Bearer ${await h.tokenFor(persona)}` } : {}),
          ...headers,
        },
        ...(payload !== undefined ? { payload: payload as Record<string, unknown> } : {}),
      });
      const body = res.body ? JSON.parse(res.body) : undefined;
      seen.push(body);
      return { status: res.statusCode, body };
    }

    const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

    const createBody = (overrides: Record<string, unknown> = {}) => ({
      groupId: groups.maple,
      title: `${TEST_TITLE_PREFIX} Evening stroll`,
      startsAt: inDays(2),
      meetingPoint: { ...SPARE_POINT },
      ...overrides,
    });

    async function createAs(
      persona: Persona,
      overrides: Record<string, unknown> = {},
    ): Promise<MeetupDetail> {
      const res = await call(persona, 'POST', '/v1/meetups', createBody(overrides));
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      return res.body.meetup as MeetupDetail;
    }

    const detail = async (persona: Persona, meetupId: string) =>
      call(persona, 'GET', `/v1/meetups/${meetupId}`);

    // -----------------------------------------------------------------
    describe('authentication', () => {
      it.each([
        ['GET', '/v1/me/groups'],
        ['GET', `/v1/groups/${groups.maple}/meetups`],
        ['GET', `/v1/meetups/${meetups.saturdayLoop}`],
        ['POST', '/v1/meetups'],
        ['POST', `/v1/meetups/${meetups.saturdayLoop}/cancel`],
        ['PUT', `/v1/meetups/${meetups.saturdayLoop}/rsvp`],
        ['DELETE', `/v1/meetups/${meetups.saturdayLoop}/rsvp`],
      ] as const)('%s %s without a token -> 401', async (method, url) => {
        const res = await call(
          null,
          method,
          url,
          method === 'POST' && url === '/v1/meetups' ? createBody() : undefined,
        );
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      });

      it('rejects an invalid token', async () => {
        const res = await call(null, 'GET', '/v1/me/groups', undefined, {
          authorization: 'Bearer not-a-real-token',
        });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      });

      it('rejects a malformed Authorization header', async () => {
        const res = await call(null, 'GET', '/v1/me/groups', undefined, {
          authorization: 'Basic abc',
        });
        expect(res.status).toBe(401);
      });

      it('health check is public', async () => {
        expect((await call(null, 'GET', '/health')).status).toBe(200);
      });
    });

    // -----------------------------------------------------------------
    describe('my groups', () => {
      it.each([
        ['sam', [groups.maple]],
        ['quinn', [groups.riverside]],
        ['riley', [groups.maple, groups.riverside]],
        ['taylor', []],
      ] as const)('%s sees only their own groups', async (persona, expected) => {
        const res = await call(persona, 'GET', '/v1/me/groups');
        expect(res.status).toBe(200);
        expect(res.body.groups.map((g: { id: string }) => g.id).sort()).toEqual(
          [...expected].sort(),
        );
      });
    });

    // -----------------------------------------------------------------
    describe('outsider (Taylor)', () => {
      const notFoundBody = { error: { code: 'NOT_FOUND', message: 'Meetup not found' } };

      it.each([
        ['detail', `/v1/meetups/${meetups.saturdayLoop}`],
        ['attendees', `/v1/meetups/${meetups.saturdayLoop}/attendees`],
        ['map', `/v1/meetups/${meetups.saturdayLoop}/map`],
      ])('cannot read the %s of a meetup (404, nothing leaked)', async (_label, url) => {
        const res = await call('taylor', 'GET', url);
        expect(res.status).toBe(404);
        expect(res.body).toEqual(notFoundBody);
        expectNoExactPoint(res.body, exactPoints.saturdayLoop);
        expect(JSON.stringify(res.body)).not.toContain('Saturday');
      });

      it("gets the same 404 for a real meetup as for one that doesn't exist", async () => {
        const real = await call('taylor', 'GET', `/v1/meetups/${meetups.saturdayLoop}`);
        const fake = await call(
          'taylor',
          'GET',
          '/v1/meetups/c3000000-0000-4000-8000-0000000000ff',
        );
        expect(real).toEqual(fake);
      });

      it.each([
        ['meetups', `/v1/groups/${groups.maple}/meetups`],
        ['map', `/v1/groups/${groups.maple}/map`],
      ])("cannot list a group's %s", async (_label, url) => {
        const res = await call('taylor', 'GET', url);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('NOT_FOUND');
      });

      it('cannot create a meetup in a group they are not in', async () => {
        const res = await call('taylor', 'POST', '/v1/meetups', createBody());
        expect(res.status).toBe(404);
        expect(res.body.error.message).toBe('Group not found');
      });

      it('cannot RSVP, withdraw or cancel', async () => {
        for (const [method, url] of [
          ['PUT', `/v1/meetups/${meetups.saturdayLoop}/rsvp`],
          ['DELETE', `/v1/meetups/${meetups.saturdayLoop}/rsvp`],
          ['POST', `/v1/meetups/${meetups.saturdayLoop}/cancel`],
        ] as const) {
          const res = await call('taylor', method, url);
          expect(res.status, `${method} ${url}`).toBe(404);
          expect(res.body).toEqual(notFoundBody);
        }
        const after = await detail('avery', meetups.saturdayLoop);
        expect(after.body.meetup.status).toBe('scheduled');
        expect(after.body.meetup.attendeeCount).toBe(2);
      });
    });

    // -----------------------------------------------------------------
    describe('member who has not RSVPd (Sam)', () => {
      it('lists the group meetups soonest first, approximate only', async () => {
        const res = await call('sam', 'GET', `/v1/groups/${groups.maple}/meetups`);
        expect(res.status).toBe(200);
        const list = res.body.meetups as MeetupSummary[];
        expect(list.map((m) => m.id)).toEqual([meetups.saturdayLoop, meetups.weeknightWalk]);
        expect(list.every((m) => m.meetingPoint.visibility === 'approximate')).toBe(true);
        expectNoExactPoint(res.body, exactPoints.saturdayLoop);
        expectNoExactPoint(res.body, exactPoints.weeknightWalk);
      });

      it('sees detail + attendee names, an approximate area (>= 300 m, not centered on the spot), no place name', async () => {
        const res = await detail('sam', meetups.saturdayLoop);
        expect(res.status).toBe(200);
        const m = res.body.meetup as MeetupDetail;
        expect(m.title).toBe('Saturday morning loop');
        expect(m.attendees.map((a) => a.displayName)).toEqual(
          expect.arrayContaining(['Jordan Price', 'Riley Chen']),
        );
        expect(m.attendees).toHaveLength(2);
        expect(m.viewer).toMatchObject({
          isCreator: false,
          isAttending: false,
          canRsvp: true,
          canCancel: false,
        });
        expect(m.meetingPoint.visibility).toBe('approximate');
        if (m.meetingPoint.visibility !== 'approximate') return;
        expect(m.meetingPoint.radiusMeters).toBeGreaterThanOrEqual(300);
        const offset = distanceMeters(
          { latitude: m.meetingPoint.centerLatitude, longitude: m.meetingPoint.centerLongitude },
          exactPoints.saturdayLoop,
        );
        expect(offset).toBeGreaterThanOrEqual(100);
        expect(offset).toBeLessThan(m.meetingPoint.radiusMeters);
        expectNoExactPoint(res.body, exactPoints.saturdayLoop);
      });

      it('attendees endpoint returns names only', async () => {
        const res = await call('sam', 'GET', `/v1/meetups/${meetups.saturdayLoop}/attendees`);
        expect(res.status).toBe(200);
        expect(Object.keys(res.body.attendees[0]).sort()).toEqual([
          'displayName',
          'rsvpAt',
          'userId',
        ]);
      });

      it('cannot cancel someone else’s meetup', async () => {
        const res = await call('sam', 'POST', `/v1/meetups/${meetups.saturdayLoop}/cancel`);
        expect(res.status).toBe(403);
        expect((await detail('avery', meetups.saturdayLoop)).body.meetup.status).toBe('scheduled');
      });

      it('RSVP switches the map to the exact point; withdraw switches it back', async () => {
        const rsvp = await call('sam', 'PUT', `/v1/meetups/${meetups.saturdayLoop}/rsvp`);
        expect(rsvp.status).toBe(200);
        const after = rsvp.body.meetup as MeetupDetail;
        expect(after.viewer.isAttending).toBe(true);
        expect(after.attendees.map((a) => a.userId)).toContain(users.sam);
        expect(after.meetingPoint).toEqual({ visibility: 'exact', ...exactPoints.saturdayLoop });

        const map = await call('sam', 'GET', `/v1/meetups/${meetups.saturdayLoop}/map`);
        expect(map.body.item.meetingPoint.visibility).toBe('exact');

        // An RSVP to one meetup grants nothing for another.
        const other = await detail('sam', meetups.weeknightWalk);
        expect(other.body.meetup.meetingPoint.visibility).toBe('approximate');
        expectNoExactPoint(other.body, exactPoints.weeknightWalk);

        const withdraw = await call('sam', 'DELETE', `/v1/meetups/${meetups.saturdayLoop}/rsvp`);
        expect(withdraw.status).toBe(200);
        expect(withdraw.body.meetup.viewer.isAttending).toBe(false);
        expect(
          withdraw.body.meetup.attendees.map((a: { userId: string }) => a.userId),
        ).not.toContain(users.sam);
        expect(withdraw.body.meetup.meetingPoint.visibility).toBe('approximate');
        expectNoExactPoint(withdraw.body, exactPoints.saturdayLoop);
      });

      it('RSVPing twice leaves one RSVP and is not an error', async () => {
        const first = await call('sam', 'PUT', `/v1/meetups/${meetups.weeknightWalk}/rsvp`);
        const second = await call('sam', 'PUT', `/v1/meetups/${meetups.weeknightWalk}/rsvp`);
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(second.body.meetup.attendeeCount).toBe(1);
        expect(
          second.body.meetup.attendees.filter((a: { userId: string }) => a.userId === users.sam),
        ).toHaveLength(1);
      });

      it('withdrawing without an RSVP is a harmless no-op', async () => {
        const res = await call('sam', 'DELETE', `/v1/meetups/${meetups.weeknightWalk}/rsvp`);
        expect(res.status).toBe(200);
        expect(res.body.meetup.attendeeCount).toBe(0);
      });
    });

    // -----------------------------------------------------------------
    describe('member who has RSVPd (Jordan on Saturday)', () => {
      it('sees the exact meeting point and place name', async () => {
        const res = await detail('jordan', meetups.saturdayLoop);
        expect(res.body.meetup.meetingPoint).toEqual({
          visibility: 'exact',
          ...exactPoints.saturdayLoop,
        });
        expect(res.body.meetup.viewer).toMatchObject({
          isAttending: true,
          canRsvp: false,
          canCancel: false,
        });
      });

      it('cannot cancel a meetup they only attend', async () => {
        const res = await call('jordan', 'POST', `/v1/meetups/${meetups.saturdayLoop}/cancel`);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      });

      it("withdrawing removes only their own RSVP (Riley's stays)", async () => {
        const res = await call('jordan', 'DELETE', `/v1/meetups/${meetups.saturdayLoop}/rsvp`);
        expect(res.status).toBe(200);
        expect(res.body.meetup.attendees.map((a: { userId: string }) => a.userId)).toEqual([
          users.riley,
        ]);
      });
    });

    // -----------------------------------------------------------------
    describe('creator (Avery)', () => {
      it('sees the exact point of their own meetup without RSVPing', async () => {
        const res = await detail('avery', meetups.saturdayLoop);
        expect(res.body.meetup.meetingPoint).toEqual({
          visibility: 'exact',
          ...exactPoints.saturdayLoop,
        });
        expect(res.body.meetup.viewer).toMatchObject({
          isCreator: true,
          isAttending: false,
          canCancel: true,
        });
      });

      it('creating a meetup: creator from the session, title trimmed, exact for the creator', async () => {
        const created = await createAs('sam', { title: `  ${TEST_TITLE_PREFIX} Trim me  ` });
        expect(created.title).toBe(`${TEST_TITLE_PREFIX} Trim me`);
        expect(created.creator.id).toBe(users.sam);
        expect(created.status).toBe('scheduled');
        expect(created.meetingPoint).toEqual({ visibility: 'exact', ...SPARE_POINT });

        // Another member sees it approximate, without the place name.
        const asJordan = await detail('jordan', created.id);
        expect(asJordan.body.meetup.meetingPoint.visibility).toBe('approximate');
        expectNoExactPoint(asJordan.body, SPARE_POINT);
      });

      it('lists in start-time order, including new meetups', async () => {
        const later = await createAs('avery', {
          title: `${TEST_TITLE_PREFIX} later`,
          startsAt: inDays(30),
        });
        const sooner = await createAs('avery', {
          title: `${TEST_TITLE_PREFIX} sooner`,
          startsAt: inDays(1),
        });
        const res = await call('sam', 'GET', `/v1/groups/${groups.maple}/meetups`);
        expect(res.body.meetups.map((m: MeetupSummary) => m.id)).toEqual([
          sooner.id,
          meetups.saturdayLoop,
          meetups.weeknightWalk,
          later.id,
        ]);
      });

      it('cancels their own meetup; it stays visible, marked cancelled; cancel is final', async () => {
        const created = await createAs('avery');
        // Jordan RSVPs before the cancel.
        expect((await call('jordan', 'PUT', `/v1/meetups/${created.id}/rsvp`)).status).toBe(200);

        // Other members and outsiders cannot cancel.
        expect((await call('jordan', 'POST', `/v1/meetups/${created.id}/cancel`)).status).toBe(403);
        expect((await call('sam', 'POST', `/v1/meetups/${created.id}/cancel`)).status).toBe(403);
        expect((await call('taylor', 'POST', `/v1/meetups/${created.id}/cancel`)).status).toBe(404);

        const cancel = await call('avery', 'POST', `/v1/meetups/${created.id}/cancel`);
        expect(cancel.status).toBe(200);
        expect(cancel.body.meetup.status).toBe('cancelled');
        expect(cancel.body.meetup.cancelledAt).toEqual(expect.any(String));
        expect(cancel.body.meetup.viewer.canCancel).toBe(false);

        // Still listed for the group, marked cancelled; existing attendee still listed.
        const list = await call('sam', 'GET', `/v1/groups/${groups.maple}/meetups`);
        const listed = (list.body.meetups as MeetupSummary[]).find((m) => m.id === created.id);
        expect(listed?.status).toBe('cancelled');
        expect(listed?.attendeeCount).toBe(1);

        // No new RSVPs.
        const rsvp = await call('sam', 'PUT', `/v1/meetups/${created.id}/rsvp`);
        expect(rsvp.status).toBe(409);
        expect(rsvp.body.error.code).toBe('MEETUP_CANCELLED');

        // Existing attendee may still withdraw.
        const withdraw = await call('jordan', 'DELETE', `/v1/meetups/${created.id}/rsvp`);
        expect(withdraw.status).toBe(200);
        expect(withdraw.body.meetup.attendeeCount).toBe(0);

        // Cancelling again is a no-op; nothing reopens it.
        const again = await call('avery', 'POST', `/v1/meetups/${created.id}/cancel`);
        expect(again.status).toBe(200);
        expect(again.body.meetup.status).toBe('cancelled');
        await expect(
          h.ownerExec(
            `update public.meetups set status = 'scheduled', cancelled_at = null where id = $1`,
            [created.id],
          ),
        ).rejects.toMatchObject({ code: 'AL004' });

        // Outsider still sees nothing.
        expect((await detail('taylor', created.id)).status).toBe(404);
      });
    });

    // -----------------------------------------------------------------
    describe('started meetup', () => {
      it('accepts no RSVP once it has started', async () => {
        const created = await createAs('avery');
        await h.ownerExec(
          `update public.meetups set starts_at = now() - interval '1 minute' where id = $1`,
          [created.id],
        );
        const view = await detail('sam', created.id);
        expect(view.body.meetup.viewer.canRsvp).toBe(false);
        const res = await call('sam', 'PUT', `/v1/meetups/${created.id}/rsvp`);
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('MEETUP_STARTED');
      });
    });

    // -----------------------------------------------------------------
    describe('multi-group member (Riley: both groups, RSVPd Saturday only)', () => {
      it('Maple list: Saturday exact (RSVPd), Weeknight approximate', async () => {
        const res = await call('riley', 'GET', `/v1/groups/${groups.maple}/meetups`);
        const byId = new Map((res.body.meetups as MeetupSummary[]).map((m) => [m.id, m]));
        expect(byId.get(meetups.saturdayLoop)?.meetingPoint).toEqual({
          visibility: 'exact',
          ...exactPoints.saturdayLoop,
        });
        expect(byId.get(meetups.weeknightWalk)?.meetingPoint.visibility).toBe('approximate');
        expectNoExactPoint(byId.get(meetups.weeknightWalk), exactPoints.weeknightWalk);
      });

      it('Riverside list: sunrise walk approximate (membership there grants no exact access)', async () => {
        const res = await call('riley', 'GET', `/v1/groups/${groups.riverside}/meetups`);
        expect(res.status).toBe(200);
        expect(res.body.meetups.map((m: MeetupSummary) => m.id)).toEqual([
          meetups.riversideSunrise,
        ]);
        expect(res.body.meetups[0].meetingPoint.visibility).toBe('approximate');
        expectNoExactPoint(res.body, exactPoints.riversideSunrise);
      });

      it('map data per group follows the same per-meetup rule', async () => {
        const maple = await call('riley', 'GET', `/v1/groups/${groups.maple}/map`);
        const riverside = await call('riley', 'GET', `/v1/groups/${groups.riverside}/map`);
        const visibility = (items: { meetupId: string; meetingPoint: { visibility: string } }[]) =>
          Object.fromEntries(items.map((i) => [i.meetupId, i.meetingPoint.visibility]));
        expect(visibility(maple.body.items)).toEqual({
          [meetups.saturdayLoop]: 'exact',
          [meetups.weeknightWalk]: 'approximate',
        });
        expect(visibility(riverside.body.items)).toEqual({
          [meetups.riversideSunrise]: 'approximate',
        });
        expectNoExactPoint(riverside.body, exactPoints.riversideSunrise);
        expectNoExactPoint(maple.body.items[1], exactPoints.weeknightWalk);
      });

      it('RSVPing in Riverside then reveals that point, and only that one', async () => {
        await call('riley', 'PUT', `/v1/meetups/${meetups.riversideSunrise}/rsvp`);
        const riverside = await call('riley', 'GET', `/v1/groups/${groups.riverside}/map`);
        expect(riverside.body.items[0].meetingPoint).toEqual({
          visibility: 'exact',
          ...exactPoints.riversideSunrise,
        });
        const maple = await call('riley', 'GET', `/v1/groups/${groups.maple}/map`);
        expect(
          maple.body.items.find((i: { meetupId: string }) => i.meetupId === meetups.weeknightWalk)
            .meetingPoint.visibility,
        ).toBe('approximate');
      });

      it('a single-group member cannot reach the other group (Quinn -> Maple)', async () => {
        expect((await call('quinn', 'GET', `/v1/groups/${groups.maple}/meetups`)).status).toBe(404);
        expect((await call('quinn', 'GET', `/v1/groups/${groups.maple}/map`)).status).toBe(404);
        expect(
          (await call('quinn', 'PUT', `/v1/meetups/${meetups.saturdayLoop}/rsvp`)).status,
        ).toBe(404);
        expect((await call('quinn', 'POST', '/v1/meetups', createBody())).status).toBe(404);
      });
    });

    // -----------------------------------------------------------------
    describe('server-side validation of writes', () => {
      it.each([
        ['empty title', { title: '' }],
        ['whitespace title', { title: '    ' }],
        ['81-char title', { title: 'a'.repeat(81) }],
        ['latitude out of range', { meetingPoint: { ...SPARE_POINT, latitude: 91 } }],
        ['longitude out of range', { meetingPoint: { ...SPARE_POINT, longitude: -181 } }],
        ['coordinates as strings', { meetingPoint: { ...SPARE_POINT, latitude: '39.99' } }],
        ['empty place name', { meetingPoint: { ...SPARE_POINT, placeName: ' ' } }],
        ['121-char place name', { meetingPoint: { ...SPARE_POINT, placeName: 'p'.repeat(121) } }],
        ['past start', { startsAt: new Date(Date.now() - 60_000).toISOString() }],
        ['current start', { startsAt: new Date().toISOString() }],
        ['malformed date', { startsAt: 'next saturday' }],
        ['non-uuid group', { groupId: 'maple' }],
        ['client-supplied creator', { createdBy: users.avery }],
      ])('rejects %s with 400 VALIDATION_FAILED', async (_label, overrides) => {
        const res = await call('sam', 'POST', '/v1/meetups', createBody(overrides));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
        expect(res.body.error.issues.length).toBeGreaterThan(0);
      });

      it('rejects malformed JSON', async () => {
        const res = await h.app.inject({
          method: 'POST',
          url: '/v1/meetups',
          headers: {
            authorization: `Bearer ${await h.tokenFor('sam')}`,
            'content-type': 'application/json',
          },
          payload: '{"title": ',
        });
        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body).error.code).toBe('VALIDATION_FAILED');
      });

      it('rejects a missing body', async () => {
        const res = await call('sam', 'POST', '/v1/meetups');
        expect(res.status).toBe(400);
      });

      it('rejects a non-UUID meetup id', async () => {
        const res = await call('sam', 'PUT', '/v1/meetups/not-a-uuid/rsvp');
        expect(res.status).toBe(400);
      });

      it('rejects an unexpected body on RSVP (e.g. trying to RSVP someone else)', async () => {
        const res = await call('sam', 'PUT', `/v1/meetups/${meetups.weeknightWalk}/rsvp`, {
          userId: users.jordan,
        });
        expect(res.status).toBe(400);
        expect((await detail('jordan', meetups.weeknightWalk)).body.meetup.attendeeCount).toBe(0);
      });
    });

    // -----------------------------------------------------------------
    describe('bonus: creator-only edit (PATCH /v1/meetups/:id)', () => {
      const newPoint = {
        placeName: 'Front steps, Elm Avenue Library',
        latitude: 40.003318,
        longitude: -99.979762,
      };

      it('creator edits title, start time and meeting point; members see the new area only', async () => {
        const created = await createAs('avery');
        const startsAt = inDays(5);
        const res = await call('avery', 'PATCH', `/v1/meetups/${created.id}`, {
          title: `  ${TEST_TITLE_PREFIX} Renamed walk `,
          startsAt,
          meetingPoint: newPoint,
        });
        expect(res.status).toBe(200);
        const m = res.body.meetup as MeetupDetail;
        expect(m.title).toBe(`${TEST_TITLE_PREFIX} Renamed walk`);
        expect(Date.parse(m.startsAt)).toBe(Date.parse(startsAt));
        expect(m.meetingPoint).toEqual({ visibility: 'exact', ...newPoint });
        expect(m.viewer.canEdit).toBe(true);

        const asSam = await detail('sam', created.id);
        const area = asSam.body.meetup.meetingPoint;
        expect(area.visibility).toBe('approximate');
        expectNoExactPoint(asSam.body, newPoint);
        expectNoExactPoint(asSam.body, SPARE_POINT);
        const d = distanceMeters(
          { latitude: area.centerLatitude, longitude: area.centerLongitude },
          newPoint,
        );
        expect(d).toBeGreaterThanOrEqual(100);
        expect(d).toBeLessThan(area.radiusMeters);
        expect(asSam.body.meetup.viewer.canEdit).toBe(false);
      });

      it('other members get 403 and outsiders 404; nothing changes', async () => {
        const created = await createAs('avery');
        const jordan = await call('jordan', 'PATCH', `/v1/meetups/${created.id}`, { title: 'x' });
        expect(jordan.status).toBe(403);
        const taylor = await call('taylor', 'PATCH', `/v1/meetups/${created.id}`, { title: 'x' });
        expect(taylor.status).toBe(404);
        expect(taylor.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Meetup not found' } });
        expect((await detail('avery', created.id)).body.meetup.title).toBe(created.title);
      });

      it('a cancelled meetup cannot be edited', async () => {
        const created = await createAs('avery');
        await call('avery', 'POST', `/v1/meetups/${created.id}/cancel`);
        const res = await call('avery', 'PATCH', `/v1/meetups/${created.id}`, { title: 'x' });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('MEETUP_CANCELLED');
      });

      it.each([
        ['an empty change set', {}],
        ['an empty title', { title: '  ' }],
        ['an 81-char title', { title: 'a'.repeat(81) }],
        ['a past start time', { startsAt: new Date(Date.now() - 60_000).toISOString() }],
        ['the current time', { startsAt: new Date().toISOString() }],
        ['bad coordinates', { meetingPoint: { ...newPoint, latitude: -91 } }],
        ['a group change', { title: 'x', groupId: groups.riverside }],
        ['a creator change', { title: 'x', createdBy: users.sam }],
        ['a status change', { status: 'scheduled' }],
      ])('rejects %s with 400', async (_label, body) => {
        const created = await createAs('avery');
        const res = await call('avery', 'PATCH', `/v1/meetups/${created.id}`, body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      });

      it('editing only the title keeps a start time that is already set', async () => {
        const created = await createAs('avery', { startsAt: inDays(4) });
        const res = await call('avery', 'PATCH', `/v1/meetups/${created.id}`, {
          title: `${TEST_TITLE_PREFIX} title only`,
        });
        expect(res.status).toBe(200);
        expect(res.body.meetup.startsAt).toBe(created.startsAt);
      });
    });

    // -----------------------------------------------------------------
    describe('home location privacy', () => {
      it('no response in this suite contained a home location', () => {
        expect(seen.length).toBeGreaterThan(50);
        for (const body of seen) expectNoHomeLocation(body);
      });
    });
  });
}
