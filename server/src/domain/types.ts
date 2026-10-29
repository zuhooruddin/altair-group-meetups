import type { MeetupStatus } from '@altair/shared';

/** The verified, signed-in member a request acts for. */
export interface Actor {
  userId: string;
}

export interface GroupRecord {
  id: string;
  name: string;
}

export interface ApproximateAreaRecord {
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
}

export interface ExactPointRecord {
  placeName: string;
  latitude: number;
  longitude: number;
}

/**
 * A meetup as the database lets the CURRENT member see it. `exactPoint` is
 * null unless RLS on meetup_meeting_points returned the row for them.
 */
export interface MeetupRecord {
  id: string;
  groupId: string;
  title: string;
  startsAt: Date;
  status: MeetupStatus;
  cancelledAt: Date | null;
  creatorId: string;
  creatorDisplayName: string;
  area: ApproximateAreaRecord;
  exactPoint: ExactPointRecord | null;
  /** Evaluated with the database clock, the same clock the RSVP trigger uses. */
  hasStarted: boolean;
  attendeeCount: number;
  viewerIsAttending: boolean;
}

export interface AttendeeRecord {
  meetupId: string;
  userId: string;
  displayName: string;
  rsvpAt: Date;
}

export interface NewMeetup {
  groupId: string;
  title: string;
  startsAt: Date;
  placeName: string;
  latitude: number;
  longitude: number;
}
