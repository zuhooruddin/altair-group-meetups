import type { MeetupDetail, MeetupMapItem, MeetupSummary } from '@altair/shared';
import { meetingPointFor, viewerFor } from '../../domain/meetup-view';
import type { Repositories } from '../../domain/ports';
import type { Actor, AttendeeRecord, MeetupRecord } from '../../domain/types';
import { notFound } from '../../domain/errors';

export function toSummary(meetup: MeetupRecord, actor: Actor): MeetupSummary {
  const viewer = viewerFor(meetup, actor);
  return {
    id: meetup.id,
    groupId: meetup.groupId,
    title: meetup.title,
    startsAt: meetup.startsAt.toISOString(),
    status: meetup.status,
    cancelledAt: meetup.cancelledAt?.toISOString() ?? null,
    creator: { id: meetup.creatorId, displayName: meetup.creatorDisplayName },
    attendeeCount: meetup.attendeeCount,
    viewer,
    meetingPoint: meetingPointFor(meetup, viewer),
  };
}

export function toMapItem(meetup: MeetupRecord, actor: Actor): MeetupMapItem {
  const summary = toSummary(meetup, actor);
  return {
    meetupId: summary.id,
    title: summary.title,
    startsAt: summary.startsAt,
    status: summary.status,
    meetingPoint: summary.meetingPoint,
  };
}

export function toAttendees(records: AttendeeRecord[]) {
  return records.map((a) => ({
    userId: a.userId,
    displayName: a.displayName,
    rsvpAt: a.rsvpAt.toISOString(),
  }));
}

/** Loads the full detail a member may see, inside an open unit of work. */
export async function loadMeetupDetail(
  repos: Repositories,
  actor: Actor,
  meetupId: string,
): Promise<MeetupDetail> {
  const meetup = await repos.meetups.findVisible(meetupId);
  if (!meetup) throw notFound('Meetup');
  const attendees = await repos.rsvps.listAttendees(meetupId);
  return { ...toSummary(meetup, actor), attendees: toAttendees(attendees) };
}
