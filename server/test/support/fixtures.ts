/** The seed cast (altair-seed-data.sql) and reference meetups (seed PART 2). */
export const users = {
  avery: 'a1000000-0000-4000-8000-000000000001', // Maple; creator of Saturday morning loop
  jordan: 'a1000000-0000-4000-8000-000000000002', // Maple; RSVP'd Saturday; creator of Weeknight
  sam: 'a1000000-0000-4000-8000-000000000003', // Maple; member, no RSVP
  riley: 'a1000000-0000-4000-8000-000000000004', // BOTH groups; RSVP'd Saturday only
  morgan: 'a1000000-0000-4000-8000-000000000005', // Riverside; creator of Riverside sunrise
  casey: 'a1000000-0000-4000-8000-000000000006', // Riverside; RSVP'd Riverside sunrise
  taylor: 'a1000000-0000-4000-8000-000000000007', // NEITHER group: outsider
  quinn: 'a1000000-0000-4000-8000-000000000008', // Riverside; member, no RSVP
} as const;

export type Persona = keyof typeof users;

export const emails: Record<Persona, string> = {
  avery: 'avery@example.test',
  jordan: 'jordan@example.test',
  sam: 'sam@example.test',
  riley: 'riley@example.test',
  morgan: 'morgan@example.test',
  casey: 'casey@example.test',
  taylor: 'taylor@example.test',
  quinn: 'quinn@example.test',
};

/** Fixture password published in the challenge seed. Development/test only. */
export const FIXTURE_PASSWORD = 'altair-fixture-pass';

export const groups = {
  maple: 'b2000000-0000-4000-8000-000000000001',
  riverside: 'b2000000-0000-4000-8000-000000000002',
} as const;

export const meetups = {
  saturdayLoop: 'c3000000-0000-4000-8000-000000000001',
  weeknightWalk: 'c3000000-0000-4000-8000-000000000002',
  riversideSunrise: 'c3000000-0000-4000-8000-000000000003',
} as const;

export const exactPoints = {
  saturdayLoop: {
    placeName: 'North gate, Linden Park',
    latitude: 40.012046,
    longitude: -99.984517,
  },
  weeknightWalk: {
    placeName: 'Front steps, Elm Avenue Library',
    latitude: 40.003318,
    longitude: -99.979762,
  },
  riversideSunrise: {
    placeName: 'Boathouse lot, Riverside Path',
    latitude: 39.985239,
    longitude: -100.009683,
  },
} as const;

export const SPARE_POINT = {
  placeName: 'Fountain plaza, Town Green',
  latitude: 39.999134,
  longitude: -99.999461,
};

/** PRIVATE home coordinates from the seed, used only to prove they never leak. */
export const homeCoordinates = [
  40.004812, -99.993127, 40.007395, -99.98864, 39.998263, -99.995418, 40.002957, -100.006284,
  39.993481, -100.011736, 39.989624, -100.004952, 40.010538, -100.014867, 39.996107, -100.017392,
];

/** Titles of meetups created by tests start with this, so cleanup never touches other data. */
export const TEST_TITLE_PREFIX = '[test]';
