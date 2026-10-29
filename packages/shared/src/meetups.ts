import { z } from 'zod';
import {
  isoDateTimeSchema,
  latitudeSchema,
  longitudeSchema,
  userSummarySchema,
  uuidSchema,
} from './common';
import { meetingPointViewSchema } from './location';

export const MEETUP_TITLE_MAX = 80;
export const PLACE_NAME_MAX = 120;

export const meetupStatusSchema = z.enum(['scheduled', 'cancelled']);
export type MeetupStatus = z.infer<typeof meetupStatusSchema>;

// ---------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------

/**
 * POST /v1/meetups
 *
 * Strict: unknown keys (e.g. a client-supplied `createdBy`) are rejected,
 * never silently used. The creator always comes from the verified session.
 * The future-start rule is evaluated at parse time, so the app shows it
 * early and the server re-checks it authoritatively on every request.
 */
const titleSchema = z
  .string({ message: 'Title is required' })
  .trim()
  .min(1, 'Title is required')
  .max(MEETUP_TITLE_MAX, `Title must be at most ${MEETUP_TITLE_MAX} characters`);

const futureStartSchema = isoDateTimeSchema.refine((value) => Date.parse(value) > Date.now(), {
  message: 'Start time must be in the future',
});

const meetingPointInputSchema = z.strictObject({
  placeName: z
    .string({ message: 'Meeting point name is required' })
    .trim()
    .min(1, 'Meeting point name is required')
    .max(PLACE_NAME_MAX, `Meeting point name must be at most ${PLACE_NAME_MAX} characters`),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});

export const createMeetupRequestSchema = z.strictObject({
  groupId: uuidSchema,
  title: titleSchema,
  startsAt: futureStartSchema,
  meetingPoint: meetingPointInputSchema,
});
export type CreateMeetupRequest = z.infer<typeof createMeetupRequestSchema>;
/** What the form holds before parsing (title untrimmed, etc.). */
export type CreateMeetupInput = z.input<typeof createMeetupRequestSchema>;

/**
 * PATCH /v1/meetups/:meetupId (bonus: creator-only edit).
 *
 * Send only what changes. A start time, when present, must be in the
 * future; omit it to keep the current one. Strict: the group, the creator
 * and the status cannot be changed through this request.
 */
export const updateMeetupRequestSchema = z
  .strictObject({
    title: titleSchema.optional(),
    startsAt: futureStartSchema.optional(),
    meetingPoint: meetingPointInputSchema.optional(),
  })
  .refine((body) => Object.values(body).some((v) => v !== undefined), {
    message: 'Nothing to update: send a title, a start time or a meeting point',
  });
export type UpdateMeetupRequest = z.infer<typeof updateMeetupRequestSchema>;
export type UpdateMeetupInput = z.input<typeof updateMeetupRequestSchema>;

/** Path params for /v1/meetups/:meetupId[/...] (cancel, RSVP, withdraw, reads). */
export const meetupIdParamsSchema = z.strictObject({ meetupId: uuidSchema });
export type MeetupIdParams = z.infer<typeof meetupIdParamsSchema>;

/** Cancel, RSVP and withdraw carry no body; anything sent must be empty. */
export const emptyBodySchema = z.strictObject({}).optional();

// ---------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------

export const attendeeSchema = z.object({
  userId: uuidSchema,
  displayName: z.string(),
  rsvpAt: isoDateTimeSchema,
});
export type Attendee = z.infer<typeof attendeeSchema>;

/** What the signed-in member may do with this meetup, decided on the server. */
export const meetupViewerSchema = z.object({
  isCreator: z.boolean(),
  isAttending: z.boolean(),
  canRsvp: z.boolean(),
  canCancel: z.boolean(),
  canEdit: z.boolean(),
});
export type MeetupViewer = z.infer<typeof meetupViewerSchema>;

export const meetupSummarySchema = z.object({
  id: uuidSchema,
  groupId: uuidSchema,
  title: z.string(),
  startsAt: isoDateTimeSchema,
  status: meetupStatusSchema,
  cancelledAt: isoDateTimeSchema.nullable(),
  creator: userSummarySchema,
  attendeeCount: z.number().int().min(0),
  viewer: meetupViewerSchema,
  meetingPoint: meetingPointViewSchema,
});
export type MeetupSummary = z.infer<typeof meetupSummarySchema>;

export const meetupDetailSchema = meetupSummarySchema.extend({
  attendees: z.array(attendeeSchema),
});
export type MeetupDetail = z.infer<typeof meetupDetailSchema>;

/** GET /v1/groups/:groupId/meetups (soonest first, cancelled included). */
export const listMeetupsResponseSchema = z.object({
  meetups: z.array(meetupSummarySchema),
});
export type ListMeetupsResponse = z.infer<typeof listMeetupsResponseSchema>;

/** GET /v1/meetups/:id, and the result of create / cancel / RSVP / withdraw. */
export const meetupDetailResponseSchema = z.object({
  meetup: meetupDetailSchema,
});
export type MeetupDetailResponse = z.infer<typeof meetupDetailResponseSchema>;

/** GET /v1/meetups/:id/attendees */
export const attendeesResponseSchema = z.object({
  meetupId: uuidSchema,
  attendees: z.array(attendeeSchema),
});
export type AttendeesResponse = z.infer<typeof attendeesResponseSchema>;

export const meetupMapItemSchema = z.object({
  meetupId: uuidSchema,
  title: z.string(),
  startsAt: isoDateTimeSchema,
  status: meetupStatusSchema,
  meetingPoint: meetingPointViewSchema,
});
export type MeetupMapItem = z.infer<typeof meetupMapItemSchema>;

/** GET /v1/meetups/:id/map */
export const meetupMapResponseSchema = z.object({ item: meetupMapItemSchema });
export type MeetupMapResponse = z.infer<typeof meetupMapResponseSchema>;

/** GET /v1/groups/:groupId/map */
export const groupMapResponseSchema = z.object({
  groupId: uuidSchema,
  items: z.array(meetupMapItemSchema),
});
export type GroupMapResponse = z.infer<typeof groupMapResponseSchema>;
