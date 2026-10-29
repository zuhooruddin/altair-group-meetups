/** API paths, shared so the app and the server can never drift apart. */
export const apiRoutes = {
  health: '/health',
  myGroups: '/v1/me/groups',
  groupMeetups: (groupId: string) => `/v1/groups/${groupId}/meetups`,
  groupMap: (groupId: string) => `/v1/groups/${groupId}/map`,
  meetups: '/v1/meetups',
  /** GET = detail, PATCH = creator-only edit (bonus). */
  meetup: (meetupId: string) => `/v1/meetups/${meetupId}`,
  meetupAttendees: (meetupId: string) => `/v1/meetups/${meetupId}/attendees`,
  meetupMap: (meetupId: string) => `/v1/meetups/${meetupId}/map`,
  cancelMeetup: (meetupId: string) => `/v1/meetups/${meetupId}/cancel`,
  /** PUT = RSVP (idempotent), DELETE = withdraw. */
  rsvp: (meetupId: string) => `/v1/meetups/${meetupId}/rsvp`,
} as const;
