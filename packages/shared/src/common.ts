import { z } from 'zod';

export const uuidSchema = z.uuid({ message: 'Must be a valid UUID' });

export const latitudeSchema = z
  .number({ message: 'Latitude must be a number' })
  .min(-90, 'Latitude must be between -90 and 90')
  .max(90, 'Latitude must be between -90 and 90');

export const longitudeSchema = z
  .number({ message: 'Longitude must be a number' })
  .min(-180, 'Longitude must be between -180 and 180')
  .max(180, 'Longitude must be between -180 and 180');

/** ISO-8601 timestamp with an explicit offset or Z, e.g. 2026-11-07T09:00:00Z. */
export const isoDateTimeSchema = z.iso.datetime({
  offset: true,
  message: 'Must be an ISO-8601 date-time with a time zone (e.g. 2026-11-07T09:00:00Z)',
});

export const userSummarySchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
});
export type UserSummary = z.infer<typeof userSummarySchema>;
