import { describe, expect, it } from 'vitest';
import { meetingPointFor, viewerFor } from '../../src/domain/meetup-view';
import type { MeetupRecord } from '../../src/domain/types';

const base: MeetupRecord = {
  id: 'c3000000-0000-4000-8000-000000000001',
  groupId: 'b2000000-0000-4000-8000-000000000001',
  title: 'Saturday morning loop',
  startsAt: new Date('2099-01-01T09:00:00Z'),
  status: 'scheduled',
  cancelledAt: null,
  creatorId: 'a1000000-0000-4000-8000-000000000001',
  creatorDisplayName: 'Avery Lin',
  area: { centerLatitude: 40.0135, centerLongitude: -99.9861, radiusMeters: 400 },
  exactPoint: { placeName: 'North gate, Linden Park', latitude: 40.012046, longitude: -99.984517 },
  hasStarted: false,
  attendeeCount: 2,
  viewerIsAttending: false,
};

const member = { userId: 'a1000000-0000-4000-8000-000000000003' };
const creator = { userId: base.creatorId };

describe('viewerFor', () => {
  it('member without RSVP can RSVP but not cancel', () => {
    expect(viewerFor(base, member)).toEqual({
      isCreator: false,
      isAttending: false,
      canRsvp: true,
      canCancel: false,
    });
  });

  it('creator can cancel while scheduled, not once cancelled', () => {
    expect(viewerFor(base, creator).canCancel).toBe(true);
    expect(
      viewerFor({ ...base, status: 'cancelled', cancelledAt: new Date() }, creator).canCancel,
    ).toBe(false);
  });

  it('no RSVP once cancelled, started, or already attending', () => {
    expect(viewerFor({ ...base, status: 'cancelled' }, member).canRsvp).toBe(false);
    expect(viewerFor({ ...base, hasStarted: true }, member).canRsvp).toBe(false);
    expect(viewerFor({ ...base, viewerIsAttending: true }, member).canRsvp).toBe(false);
  });
});

describe('meetingPointFor (second layer behind RLS)', () => {
  it('never returns the exact point to a non-attendee, even if a query fetched it', () => {
    const view = meetingPointFor(base, viewerFor(base, member));
    expect(view).toEqual({
      visibility: 'approximate',
      label: expect.any(String),
      centerLatitude: 40.0135,
      centerLongitude: -99.9861,
      radiusMeters: 400,
    });
    expect(JSON.stringify(view)).not.toContain('North gate');
  });

  it('returns exact to the creator and to attendees', () => {
    expect(meetingPointFor(base, viewerFor(base, creator)).visibility).toBe('exact');
    const attending = { ...base, viewerIsAttending: true };
    expect(meetingPointFor(attending, viewerFor(attending, member))).toEqual({
      visibility: 'exact',
      placeName: 'North gate, Linden Park',
      latitude: 40.012046,
      longitude: -99.984517,
    });
  });

  it('falls back to the area if the database withheld the exact point', () => {
    const withheld = { ...base, viewerIsAttending: true, exactPoint: null };
    expect(meetingPointFor(withheld, viewerFor(withheld, member)).visibility).toBe('approximate');
  });
});
