import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './common';

/**
 * Bonus work sample: live walk positions over Supabase Realtime Broadcast.
 * Positions are SYNTHETIC (simulated walkers), never a member's real or home
 * location. The channel is private: Realtime Authorization (RLS on
 * realtime.messages) admits only the meetup's creator and attendees.
 */
export const LIVE_POSITION_EVENT = 'position';

export const liveWalkTopic = (meetupId: string) => `meetup:${meetupId}:live`;

export const livePositionSchema = z.strictObject({
  participantId: z.string().regex(/^[a-z0-9-]{1,64}$/, 'participantId must be a short slug'),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  /** Sender clock, ms since epoch. */
  ts: z.number().int().positive(),
  /** Per-participant, strictly increasing. */
  seq: z.number().int().min(0),
});
export type LivePosition = z.infer<typeof livePositionSchema>;
