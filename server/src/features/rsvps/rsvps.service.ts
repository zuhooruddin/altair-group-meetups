import type { MeetupDetail } from '@altair/shared';
import { meetupCancelled, meetupStarted, notFound } from '../../domain/errors';
import type { UnitOfWork } from '../../domain/ports';
import type { Actor } from '../../domain/types';
import { loadMeetupDetail } from '../meetups/meetup-read-model';

export class RsvpsService {
  constructor(private readonly uow: UnitOfWork) {}

  /**
   * RSVP the caller. Idempotent: RSVPing twice leaves one RSVP and is not an
   * error, even if the meetup has since been cancelled or started (the
   * existing RSVP simply stands). A new RSVP to a cancelled or started
   * meetup is refused here, and again by the database trigger.
   */
  rsvp(actor: Actor, meetupId: string): Promise<MeetupDetail> {
    return this.uow.write(actor, async (repos) => {
      const meetup = await repos.meetups.findVisible(meetupId);
      if (!meetup) throw notFound('Meetup');
      if (!meetup.viewerIsAttending) {
        if (meetup.status === 'cancelled') throw meetupCancelled();
        if (meetup.hasStarted) throw meetupStarted();
        await repos.rsvps.addForCaller(meetupId);
      }
      return loadMeetupDetail(repos, actor, meetupId);
    });
  }

  /** Withdraw the caller's own RSVP. Allowed after cancellation. Idempotent. */
  withdraw(actor: Actor, meetupId: string): Promise<MeetupDetail> {
    return this.uow.write(actor, async (repos) => {
      if (!(await repos.meetups.findVisible(meetupId))) throw notFound('Meetup');
      await repos.rsvps.removeForCaller(meetupId);
      return loadMeetupDetail(repos, actor, meetupId);
    });
  }
}
