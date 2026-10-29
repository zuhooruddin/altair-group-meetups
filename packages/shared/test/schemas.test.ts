import { describe, expect, it } from 'vitest';
import {
  createMeetupRequestSchema,
  meetingPointViewSchema,
  meetupSummarySchema,
  meetupIdParamsSchema,
} from '../src';

const inOneHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

const validBody = () => ({
  groupId: 'b2000000-0000-4000-8000-000000000001',
  title: 'Evening stroll',
  startsAt: inOneHour(),
  meetingPoint: {
    placeName: 'Fountain plaza, Town Green',
    latitude: 39.999134,
    longitude: -99.999461,
  },
});

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((i) => i.path.join('.')) ?? [];

describe('createMeetupRequestSchema', () => {
  it('accepts a valid future meetup and trims title and place name', () => {
    const parsed = createMeetupRequestSchema.parse({
      ...validBody(),
      title: '   Evening stroll  ',
      meetingPoint: { ...validBody().meetingPoint, placeName: '  Fountain plaza  ' },
    });
    expect(parsed.title).toBe('Evening stroll');
    expect(parsed.meetingPoint.placeName).toBe('Fountain plaza');
  });

  it('rejects an empty or whitespace-only title', () => {
    for (const title of ['', '    ']) {
      const result = createMeetupRequestSchema.safeParse({ ...validBody(), title });
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain('title');
    }
  });

  it('accepts 80 characters and rejects 81 (after trimming)', () => {
    expect(
      createMeetupRequestSchema.safeParse({ ...validBody(), title: 'a'.repeat(80) }).success,
    ).toBe(true);
    expect(
      createMeetupRequestSchema.safeParse({ ...validBody(), title: ` ${'a'.repeat(80)} ` }).success,
    ).toBe(true);
    expect(
      createMeetupRequestSchema.safeParse({ ...validBody(), title: 'a'.repeat(81) }).success,
    ).toBe(false);
  });

  it('enforces 1..120 characters for the meeting point name', () => {
    const withName = (placeName: string) => ({
      ...validBody(),
      meetingPoint: { ...validBody().meetingPoint, placeName },
    });
    expect(createMeetupRequestSchema.safeParse(withName('x'.repeat(120))).success).toBe(true);
    expect(createMeetupRequestSchema.safeParse(withName('x'.repeat(121))).success).toBe(false);
    expect(createMeetupRequestSchema.safeParse(withName('  ')).success).toBe(false);
  });

  it('rejects out-of-range or non-numeric coordinates', () => {
    const cases = [
      { latitude: 90.0001, longitude: 0 },
      { latitude: -90.0001, longitude: 0 },
      { latitude: 0, longitude: 180.0001 },
      { latitude: 0, longitude: -180.0001 },
      { latitude: '40', longitude: 0 },
      { latitude: Number.NaN, longitude: 0 },
      { latitude: Number.POSITIVE_INFINITY, longitude: 0 },
    ];
    for (const c of cases) {
      const body = { ...validBody(), meetingPoint: { placeName: 'Somewhere', ...c } };
      expect(createMeetupRequestSchema.safeParse(body).success, JSON.stringify(c)).toBe(false);
    }
  });

  it('rejects past and current start times', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const now = new Date().toISOString();
    expect(createMeetupRequestSchema.safeParse({ ...validBody(), startsAt: past }).success).toBe(
      false,
    );
    expect(createMeetupRequestSchema.safeParse({ ...validBody(), startsAt: now }).success).toBe(
      false,
    );
  });

  it('rejects malformed dates and dates without a time zone', () => {
    for (const startsAt of [
      'tomorrow',
      '2026-13-45T10:00:00Z',
      '2099-01-01T10:00:00',
      1893456000000,
    ]) {
      expect(
        createMeetupRequestSchema.safeParse({ ...validBody(), startsAt }).success,
        String(startsAt),
      ).toBe(false);
    }
    expect(
      createMeetupRequestSchema.safeParse({ ...validBody(), startsAt: '2099-01-01T10:00:00+02:00' })
        .success,
    ).toBe(true);
  });

  it('rejects a client-supplied creator or any unknown key', () => {
    const result = createMeetupRequestSchema.safeParse({
      ...validBody(),
      createdBy: 'a1000000-0000-4000-8000-000000000007',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-UUID group id and missing fields', () => {
    expect(createMeetupRequestSchema.safeParse({ ...validBody(), groupId: 'maple' }).success).toBe(
      false,
    );
    expect(createMeetupRequestSchema.safeParse({}).success).toBe(false);
    expect(createMeetupRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe('meetupIdParamsSchema', () => {
  it('requires a UUID', () => {
    expect(
      meetupIdParamsSchema.safeParse({ meetupId: 'c3000000-0000-4000-8000-000000000001' }).success,
    ).toBe(true);
    expect(meetupIdParamsSchema.safeParse({ meetupId: '1; drop table meetups' }).success).toBe(
      false,
    );
  });
});

describe('meetingPointViewSchema', () => {
  it('requires an approximate radius of at least 300 m', () => {
    const area = {
      visibility: 'approximate',
      label: 'Approximate area',
      centerLatitude: 40,
      centerLongitude: -100,
    };
    expect(meetingPointViewSchema.safeParse({ ...area, radiusMeters: 299 }).success).toBe(false);
    expect(meetingPointViewSchema.safeParse({ ...area, radiusMeters: 300 }).success).toBe(true);
  });

  it('strips anything not in the contract (e.g. an exact point smuggled into an approximate view)', () => {
    const parsed = meetingPointViewSchema.parse({
      visibility: 'approximate',
      label: 'Approximate area',
      centerLatitude: 40,
      centerLongitude: -100,
      radiusMeters: 400,
      latitude: 40.012046,
      placeName: 'North gate, Linden Park',
    });
    expect(parsed).not.toHaveProperty('latitude');
    expect(parsed).not.toHaveProperty('placeName');
  });
});

describe('meetupSummarySchema', () => {
  it('strips home-location fields if a server bug ever put them on the creator', () => {
    const parsed = meetupSummarySchema.parse({
      id: 'c3000000-0000-4000-8000-000000000001',
      groupId: 'b2000000-0000-4000-8000-000000000001',
      title: 'Saturday morning loop',
      startsAt: '2099-01-01T10:00:00Z',
      status: 'scheduled',
      cancelledAt: null,
      creator: {
        id: 'a1000000-0000-4000-8000-000000000001',
        displayName: 'Avery Lin',
        home_lat: 40.0048,
      },
      attendeeCount: 2,
      viewer: { isCreator: false, isAttending: false, canRsvp: true, canCancel: false },
      meetingPoint: {
        visibility: 'approximate',
        label: 'x',
        centerLatitude: 40,
        centerLongitude: -100,
        radiusMeters: 400,
      },
    });
    expect(JSON.stringify(parsed)).not.toContain('home');
  });
});
