import type {
  AttendeesResponse,
  CreateMeetupRequest,
  GroupMapResponse,
  ListMeetupsResponse,
  MeetupDetail,
  MeetupMapResponse,
} from '@altair/shared';
import { AppError, notFound } from '../../domain/errors';
import type { UnitOfWork } from '../../domain/ports';
import type { Actor } from '../../domain/types';
import { loadMeetupDetail, toAttendees, toMapItem, toSummary } from './meetup-read-model';

export class MeetupsService {
  constructor(private readonly uow: UnitOfWork) {}

  listForGroup(actor: Actor, groupId: string): Promise<ListMeetupsResponse> {
    return this.uow.read(actor, async (repos) => {
      // Non-members get the same 404 as for a group that does not exist.
      if (!(await repos.groups.findVisible(groupId))) throw notFound('Group');
      const meetups = await repos.meetups.listByGroup(groupId);
      return { meetups: meetups.map((m) => toSummary(m, actor)) };
    });
  }

  getDetail(actor: Actor, meetupId: string): Promise<MeetupDetail> {
    return this.uow.read(actor, (repos) => loadMeetupDetail(repos, actor, meetupId));
  }

  getAttendees(actor: Actor, meetupId: string): Promise<AttendeesResponse> {
    return this.uow.read(actor, async (repos) => {
      if (!(await repos.meetups.findVisible(meetupId))) throw notFound('Meetup');
      return { meetupId, attendees: toAttendees(await repos.rsvps.listAttendees(meetupId)) };
    });
  }

  getMeetupMap(actor: Actor, meetupId: string): Promise<MeetupMapResponse> {
    return this.uow.read(actor, async (repos) => {
      const meetup = await repos.meetups.findVisible(meetupId);
      if (!meetup) throw notFound('Meetup');
      return { item: toMapItem(meetup, actor) };
    });
  }

  getGroupMap(actor: Actor, groupId: string): Promise<GroupMapResponse> {
    return this.uow.read(actor, async (repos) => {
      if (!(await repos.groups.findVisible(groupId))) throw notFound('Group');
      const meetups = await repos.meetups.listByGroup(groupId);
      return { groupId, items: meetups.map((m) => toMapItem(m, actor)) };
    });
  }

  /** `input` has already passed createMeetupRequestSchema. */
  create(actor: Actor, input: CreateMeetupRequest): Promise<MeetupDetail> {
    return this.uow.write(actor, async (repos) => {
      if (!(await repos.groups.findVisible(input.groupId))) throw notFound('Group');
      const id = await repos.meetups.create({
        groupId: input.groupId,
        title: input.title,
        startsAt: new Date(input.startsAt),
        placeName: input.meetingPoint.placeName,
        latitude: input.meetingPoint.latitude,
        longitude: input.meetingPoint.longitude,
      });
      return loadMeetupDetail(repos, actor, id);
    });
  }

  /**
   * Creator-only. Cancelling an already-cancelled meetup is a no-op that
   * returns it (cancellation is final; there is no way back to scheduled).
   */
  cancel(actor: Actor, meetupId: string): Promise<MeetupDetail> {
    return this.uow.write(actor, async (repos) => {
      const meetup = await repos.meetups.findVisible(meetupId);
      if (!meetup) throw notFound('Meetup');
      if (meetup.creatorId !== actor.userId) {
        throw new AppError('FORBIDDEN', 'Only the member who created this meetup can cancel it');
      }
      if (meetup.status === 'scheduled') {
        const changed = await repos.meetups.cancel(meetupId);
        if (!changed) {
          // RLS refused the update even though the read said "creator":
          // treat as forbidden rather than pretending it worked.
          throw new AppError('FORBIDDEN', 'Only the member who created this meetup can cancel it');
        }
      }
      return loadMeetupDetail(repos, actor, meetupId);
    });
  }
}
