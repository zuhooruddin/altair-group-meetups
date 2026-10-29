import type { RsvpRepository } from '../../domain/ports';
import type { AttendeeRecord } from '../../domain/types';
import type { SqlClient } from '../db/sql-client';

interface AttendeeRow extends Record<string, unknown> {
  meetup_id: string;
  user_id: string;
  display_name: string;
  created_at: Date;
}

export class PgRsvpRepository implements RsvpRepository {
  constructor(private readonly db: SqlClient) {}

  async listAttendees(meetupId: string): Promise<AttendeeRecord[]> {
    const { rows } = await this.db.query<AttendeeRow>(
      `select r.meetup_id, r.user_id,
              coalesce(u.display_name, 'Former member') as display_name,
              r.created_at
         from public.rsvps r
         left join public.users u on u.id = r.user_id
        where r.meetup_id = $1
        order by r.created_at asc, r.user_id asc`,
      [meetupId],
    );
    return rows.map((r) => ({
      meetupId: r.meetup_id,
      userId: r.user_id,
      displayName: r.display_name,
      rsvpAt: new Date(r.created_at),
    }));
  }

  async addForCaller(meetupId: string): Promise<void> {
    await this.db.query(
      `insert into public.rsvps (meetup_id, user_id)
       values ($1, app.current_user_id())
       on conflict (meetup_id, user_id) do nothing`,
      [meetupId],
    );
  }

  async removeForCaller(meetupId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `delete from public.rsvps where meetup_id = $1 and user_id = app.current_user_id()`,
      [meetupId],
    );
    return (rowCount ?? 0) > 0;
  }
}
