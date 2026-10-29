import {
  cullToViewport,
  interpolate,
  PositionTracker,
  type TrackerOptions,
} from '../src/features/live-walk/engine';

const options: TrackerOptions = {
  renderDelayMs: 1000,
  staleAfterMs: 3000,
  dropAfterMs: 10000,
  bufferSize: 4,
};
const msg = (
  seq: number,
  ts: number,
  latitude = 40,
  longitude = -100,
  participantId = 'walker-01',
) => ({
  participantId,
  latitude,
  longitude,
  ts,
  seq,
});

describe('payload validation', () => {
  it.each([
    ['missing fields', { participantId: 'walker-01' }],
    ['latitude out of range', msg(1, 1000, 91)],
    ['non-numeric', { ...msg(1, 1000), latitude: '40' }],
    ['bad participant id', { ...msg(1, 1000), participantId: 'Robert"); DROP' }],
    ['negative seq', msg(-1, 1000)],
    ['extra field (e.g. a home location)', { ...msg(1, 1000), homeLat: 40.1 }],
    ['not an object', 'hello'],
  ])('rejects %s', (_label, raw) => {
    const tracker = new PositionTracker(options);
    expect(tracker.ingest(raw, 1000)).toBe('invalid');
    expect(tracker.size).toBe(0);
  });
});

describe('interpolation', () => {
  it('blends linearly and clamps t', () => {
    const a = { latitude: 40, longitude: -100 };
    const b = { latitude: 41, longitude: -98 };
    expect(interpolate(a, b, 0.25)).toEqual({ latitude: 40.25, longitude: -99.5 });
    expect(interpolate(a, b, -1)).toEqual(a);
    expect(interpolate(a, b, 2)).toEqual(b);
  });

  it('draws a participant between its two samples, renderDelay behind real time', () => {
    const tracker = new PositionTracker(options);
    tracker.ingest(msg(1, 10_000, 40.0), 10_000);
    tracker.ingest(msg(2, 12_000, 40.002), 12_000);
    // now 12_000 -> render time 11_000: halfway between the samples.
    const [p] = tracker.positionsAt(12_000);
    expect(p?.latitude).toBeCloseTo(40.001, 9);
  });

  it('holds the last sample instead of extrapolating', () => {
    const tracker = new PositionTracker(options);
    tracker.ingest(msg(1, 10_000, 40.0), 10_000);
    tracker.ingest(msg(2, 12_000, 40.002), 12_000);
    expect(tracker.positionsAt(60_000)[0]?.latitude).toBe(40.002);
  });

  it('maps sender time onto the device clock (clock skew)', () => {
    const tracker = new PositionTracker(options);
    // Sender clock is 1 hour behind the device; deliveries take ~0 ms.
    const skew = 3_600_000;
    tracker.ingest(msg(1, 10_000, 40.0), 10_000 + skew);
    tracker.ingest(msg(2, 12_000, 40.002), 12_000 + skew);
    expect(tracker.positionsAt(12_000 + skew)[0]?.latitude).toBeCloseTo(40.001, 9);
  });
});

describe('ordering and staleness', () => {
  it('drops out-of-order and duplicate messages', () => {
    const tracker = new PositionTracker(options);
    expect(tracker.ingest(msg(5, 10_000), 10_000)).toBe('accepted');
    expect(tracker.ingest(msg(5, 10_000), 10_050)).toBe('duplicate');
    expect(tracker.ingest(msg(4, 9_000), 10_100)).toBe('out-of-order');
    expect(tracker.ingest(msg(6, 11_000), 11_000)).toBe('accepted');
    expect(tracker.counters).toMatchObject({ accepted: 2, duplicate: 1, outOfOrder: 1 });
  });

  it('a late out-of-order message never moves the marker backwards', () => {
    const tracker = new PositionTracker(options);
    tracker.ingest(msg(1, 10_000, 40.0), 10_000);
    tracker.ingest(msg(3, 12_000, 40.002), 12_000);
    tracker.ingest(msg(2, 11_000, 39.0), 12_100); // late, wrong place
    expect(tracker.positionsAt(20_000)[0]?.latitude).toBe(40.002);
  });

  it('drops messages that arrive much later than the fastest delivery (stale)', () => {
    const tracker = new PositionTracker(options);
    tracker.ingest(msg(1, 10_000), 10_000); // establishes ~0 ms delivery
    expect(tracker.ingest(msg(2, 11_000), 11_000 + 3_500)).toBe('stale');
    expect(tracker.ingest(msg(3, 12_000), 12_000 + 500)).toBe('accepted');
  });

  it('forgets participants that went silent', () => {
    const tracker = new PositionTracker(options);
    tracker.ingest(msg(1, 10_000, 40, -100, 'walker-01'), 10_000);
    tracker.ingest(msg(1, 19_000, 40, -100, 'walker-02'), 19_000);
    expect(tracker.prune(21_000)).toBe(1);
    expect(tracker.positionsAt(21_000).map((p) => p.participantId)).toEqual(['walker-02']);
  });

  it('tracks participants independently', () => {
    const tracker = new PositionTracker(options);
    expect(tracker.ingest(msg(9, 10_000, 40, -100, 'walker-01'), 10_000)).toBe('accepted');
    expect(tracker.ingest(msg(1, 10_000, 40, -100, 'walker-02'), 10_000)).toBe('accepted');
  });
});

describe('viewport culling', () => {
  const region = { latitude: 40, longitude: -100, latitudeDelta: 0.01, longitudeDelta: 0.01 };
  const at = (id: string, latitude: number, longitude: number) => ({
    participantId: id,
    latitude,
    longitude,
  });

  it('keeps points inside the view plus margin, drops the rest', () => {
    const points = [
      at('center', 40, -100),
      at('edge', 40.0049, -100),
      at('in-margin', 40.0055, -100), // 0.005 half-height * 1.2 = 0.006
      at('outside', 40.0065, -100),
      at('far-west', 40, -100.02),
    ];
    expect(cullToViewport(points, region, 0.2).map((p) => p.participantId)).toEqual([
      'center',
      'edge',
      'in-margin',
    ]);
  });

  it('with no margin, only what is on screen', () => {
    expect(cullToViewport([at('in-margin', 40.0055, -100)], region, 0)).toEqual([]);
  });
});
