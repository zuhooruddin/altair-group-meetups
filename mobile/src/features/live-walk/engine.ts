import { livePositionSchema, type LivePosition } from '@altair/shared';

/**
 * Pure, framework-free logic for the live walk map (bonus work sample):
 * validation, ordering, staleness, interpolation and viewport culling.
 * No React, no timers; the screen drives it with `now`.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface RenderedParticipant extends LatLng {
  participantId: string;
}

export type IngestResult = 'accepted' | 'invalid' | 'stale' | 'out-of-order' | 'duplicate';

export interface TrackerOptions {
  /** Draw this far in the past so there are usually two samples to blend between. */
  renderDelayMs: number;
  /** A message that arrives this much later than the fastest one so far is dropped. */
  staleAfterMs: number;
  /** Forget a participant after this long without updates. */
  dropAfterMs: number;
  /** Samples kept per participant. */
  bufferSize: number;
}

export const DEFAULT_TRACKER_OPTIONS: TrackerOptions = {
  renderDelayMs: 2500,
  staleAfterMs: 8000,
  dropAfterMs: 30000,
  bufferSize: 4,
};

interface Sample extends LatLng {
  /** Local-clock time this position was true (sender ts mapped by the clock offset). */
  at: number;
  seq: number;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Linear interpolation between two positions; t is clamped to [0, 1]. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.min(1, Math.max(0, t));
  return {
    latitude: lerp(a.latitude, b.latitude, k),
    longitude: lerp(a.longitude, b.longitude, k),
  };
}

export class PositionTracker {
  private readonly samples = new Map<string, Sample[]>();
  private readonly lastSeq = new Map<string, number>();
  /** Estimated (local clock - sender clock), from the fastest delivery seen. */
  private clockOffset: number | null = null;
  readonly counters = { accepted: 0, invalid: 0, stale: 0, outOfOrder: 0, duplicate: 0 };

  constructor(private readonly options: TrackerOptions = DEFAULT_TRACKER_OPTIONS) {}

  ingest(raw: unknown, receivedAt: number): IngestResult {
    const parsed = livePositionSchema.safeParse(raw);
    if (!parsed.success) return this.count('invalid');
    const msg: LivePosition = parsed.data;

    // Sender and device clocks differ: track the smallest observed
    // (receivedAt - ts). Network delay only ever makes that number larger,
    // so the minimum is the best estimate of the pure clock offset.
    const observed = receivedAt - msg.ts;
    if (this.clockOffset === null || observed < this.clockOffset) this.clockOffset = observed;
    const extraDelay = observed - this.clockOffset;
    if (extraDelay > this.options.staleAfterMs) return this.count('stale');

    const last = this.lastSeq.get(msg.participantId);
    if (last !== undefined && msg.seq === last) return this.count('duplicate');
    if (last !== undefined && msg.seq < last) return this.count('out-of-order');

    this.lastSeq.set(msg.participantId, msg.seq);
    const buffer = this.samples.get(msg.participantId) ?? [];
    buffer.push({
      latitude: msg.latitude,
      longitude: msg.longitude,
      at: msg.ts + this.clockOffset,
      seq: msg.seq,
    });
    while (buffer.length > this.options.bufferSize) buffer.shift();
    this.samples.set(msg.participantId, buffer);
    return this.count('accepted');
  }

  /** Where each participant should be drawn at local time `now`. */
  positionsAt(now: number): RenderedParticipant[] {
    const renderTime = now - this.options.renderDelayMs;
    const out: RenderedParticipant[] = [];
    for (const [participantId, buffer] of this.samples) {
      const position = positionInBuffer(buffer, renderTime);
      if (position) out.push({ participantId, ...position });
    }
    return out;
  }

  /** Forgets participants with no update for `dropAfterMs`. Returns how many were removed. */
  prune(now: number): number {
    let removed = 0;
    for (const [id, buffer] of this.samples) {
      const newest = buffer[buffer.length - 1];
      if (!newest || now - newest.at > this.options.dropAfterMs) {
        this.samples.delete(id);
        this.lastSeq.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  get size(): number {
    return this.samples.size;
  }

  private count(result: IngestResult): IngestResult {
    const key = result === 'out-of-order' ? 'outOfOrder' : result;
    this.counters[key] += 1;
    return result;
  }
}

/**
 * Before the first sample: hold the first. Between samples: blend linearly.
 * After the last: hold the last (no extrapolation, so a stalled sender never
 * walks off in a straight line).
 */
function positionInBuffer(buffer: Sample[], t: number): LatLng | null {
  const first = buffer[0];
  const last = buffer[buffer.length - 1];
  if (!first || !last) return null;
  if (t <= first.at) return { latitude: first.latitude, longitude: first.longitude };
  if (t >= last.at) return { latitude: last.latitude, longitude: last.longitude };
  for (let i = 1; i < buffer.length; i += 1) {
    const a = buffer[i - 1]!;
    const b = buffer[i]!;
    if (t <= b.at) return interpolate(a, b, b.at === a.at ? 1 : (t - a.at) / (b.at - a.at));
  }
  return { latitude: last.latitude, longitude: last.longitude };
}

/**
 * Keeps only participants inside the visible region grown by `marginRatio`
 * on every side, so markers entering the screen are already mounted while
 * everything further away costs nothing to render.
 */
export function cullToViewport<T extends LatLng>(
  items: T[],
  region: Region,
  marginRatio = 0.2,
): T[] {
  const halfLat = (region.latitudeDelta / 2) * (1 + marginRatio);
  const halfLng = (region.longitudeDelta / 2) * (1 + marginRatio);
  const minLat = region.latitude - halfLat;
  const maxLat = region.latitude + halfLat;
  const minLng = region.longitude - halfLng;
  const maxLng = region.longitude + halfLng;
  return items.filter(
    (p) =>
      p.latitude >= minLat &&
      p.latitude <= maxLat &&
      p.longitude >= minLng &&
      p.longitude <= maxLng,
  );
}
