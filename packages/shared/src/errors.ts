import { z } from 'zod';

export const apiErrorCodes = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'MEETUP_CANCELLED',
  'MEETUP_STARTED',
  'START_TIME_NOT_IN_FUTURE',
  'INTERNAL',
] as const;

export const apiErrorCodeSchema = z.enum(apiErrorCodes);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    issues: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
