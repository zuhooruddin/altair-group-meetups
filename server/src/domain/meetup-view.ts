import type { MeetingPointView, MeetupViewer } from '@altair/shared';
import type { Actor, MeetupRecord } from './types';

export const APPROXIMATE_AREA_LABEL = 'Approximate area · RSVP to see the exact meeting point';

/** What this member may do with the meetup. */
export function viewerFor(meetup: MeetupRecord, actor: Actor): MeetupViewer {
  const isCreator = meetup.creatorId === actor.userId;
  const isScheduled = meetup.status === 'scheduled';
  return {
    isCreator,
    isAttending: meetup.viewerIsAttending,
    canRsvp: isScheduled && !meetup.hasStarted && !meetup.viewerIsAttending,
    canCancel: isCreator && isScheduled,
  };
}

/**
 * The meeting point this member may see.
 *
 * The database is the enforcement point: `exactPoint` is only populated when
 * RLS on meetup_meeting_points returned the row. This function is a second,
 * independent check: even if a query bug ever fetched the exact point for
 * someone who is neither the creator nor an attendee, it is not sent.
 */
export function meetingPointFor(meetup: MeetupRecord, viewer: MeetupViewer): MeetingPointView {
  const entitledToExact = viewer.isCreator || viewer.isAttending;
  if (entitledToExact && meetup.exactPoint) {
    return {
      visibility: 'exact',
      placeName: meetup.exactPoint.placeName,
      latitude: meetup.exactPoint.latitude,
      longitude: meetup.exactPoint.longitude,
    };
  }
  return {
    visibility: 'approximate',
    label: APPROXIMATE_AREA_LABEL,
    centerLatitude: meetup.area.centerLatitude,
    centerLongitude: meetup.area.centerLongitude,
    radiusMeters: meetup.area.radiusMeters,
  };
}
