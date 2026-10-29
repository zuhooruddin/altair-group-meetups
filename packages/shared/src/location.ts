import { z } from 'zod';
import { latitudeSchema, longitudeSchema } from './common';

export const MIN_APPROXIMATE_RADIUS_METERS = 300;

/** Shown to the creator and to members who have RSVP'd. */
export const exactMeetingPointSchema = z.object({
  visibility: z.literal('exact'),
  placeName: z.string(),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

/**
 * Shown to group members who have not RSVP'd. Computed in the database;
 * the center is offset from the exact point and the place name is withheld.
 */
export const approximateAreaSchema = z.object({
  visibility: z.literal('approximate'),
  label: z.string(),
  centerLatitude: latitudeSchema,
  centerLongitude: longitudeSchema,
  radiusMeters: z.number().int().min(MIN_APPROXIMATE_RADIUS_METERS),
});

export const meetingPointViewSchema = z.discriminatedUnion('visibility', [
  exactMeetingPointSchema,
  approximateAreaSchema,
]);

export type ExactMeetingPoint = z.infer<typeof exactMeetingPointSchema>;
export type ApproximateArea = z.infer<typeof approximateAreaSchema>;
export type MeetingPointView = z.infer<typeof meetingPointViewSchema>;
