import type { MeetupStatus } from '@altair/shared';
import type { MeetupRepository } from '../../domain/ports';
import type { MeetupChanges, MeetupRecord, NewMeetup } from '../../domain/types';
import type { SqlClient } from '../db/sql-client';

interface MeetupRow extends Record<string, unknown> {
  id: string;
  group_id: string;
  title: string;
  starts_at: Date;
  status: MeetupStatus;
  cancelled_at: Date | null;
  created_by: string;
  creator_display_name: string;
  area_center_lat: number;
  area_center_lng: number;
  area_radius_m: number;
  has_started: boolean;
  attendee_count: number;
  viewer_is_attending: boolean;
  place_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Explicit columns only. users contributes display_name and nothing else
// (the client-facing roles are not even granted home_lat / home_lng).
// The LEFT JOIN to meetup_meeting_points returns NULLs unless RLS lets this
// member see the exact point (creator or attendee).
const SELECT_MEETUPS = `
  select m.id, m.group_id, m.title, m.starts_at, m.status, m.cancelled_at,
         m.created_by,
         coalesce(u.display_name, 'Former member') as creator_display_name,
         m.area_center_lat, m.area_center_lng, m.area_radius_m,
         (m.starts_at <= now()) as has_started,
         (select count(*)::int from public.rsvps r where r.meetup_id = m.id) as attendee_count,
         exists (
           select 1 from public.rsvps r
            where r.meetup_id = m.id and r.user_id = app.current_user_id()
         ) as viewer_is_attending,
         mp.place_name, mp.latitude, mp.longitude
    from public.meetups m
    left join public.users u on u.id = m.created_by
    left join public.meetup_meeting_points mp on mp.meetup_id = m.id`;

function toRecord(row: MeetupRow): MeetupRecord {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    startsAt: new Date(row.starts_at),
    status: row.status,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
    creatorId: row.created_by,
    creatorDisplayName: row.creator_display_name,
    area: {
      centerLatitude: Number(row.area_center_lat),
      centerLongitude: Number(row.area_center_lng),
      radiusMeters: Number(row.area_radius_m),
    },
    exactPoint:
      row.place_name !== null && row.latitude !== null && row.longitude !== null
        ? {
            placeName: row.place_name,
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
          }
        : null,
    hasStarted: row.has_started,
    attendeeCount: Number(row.attendee_count),
    viewerIsAttending: row.viewer_is_attending,
  };
}

export class PgMeetupRepository implements MeetupRepository {
  constructor(private readonly db: SqlClient) {}

  async listByGroup(groupId: string): Promise<MeetupRecord[]> {
    const { rows } = await this.db.query<MeetupRow>(
      `${SELECT_MEETUPS} where m.group_id = $1 order by m.starts_at asc, m.id asc`,
      [groupId],
    );
    return rows.map(toRecord);
  }

  async findVisible(meetupId: string): Promise<MeetupRecord | null> {
    const { rows } = await this.db.query<MeetupRow>(`${SELECT_MEETUPS} where m.id = $1`, [
      meetupId,
    ]);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async create(input: NewMeetup): Promise<string> {
    // The creator is the session's member, never a value from the request.
    const { rows } = await this.db.query<{ id: string }>(
      `select app.insert_meetup(
                p_group_id   => $1,
                p_created_by => app.current_user_id(),
                p_title      => $2,
                p_starts_at  => $3,
                p_place_name => $4,
                p_latitude   => $5,
                p_longitude  => $6) as id`,
      [
        input.groupId,
        input.title,
        input.startsAt.toISOString(),
        input.placeName,
        input.latitude,
        input.longitude,
      ],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error('insert_meetup returned no id');
    return id;
  }

  async cancel(meetupId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `update public.meetups set status = 'cancelled'
        where id = $1 and status = 'scheduled'`,
      [meetupId],
    );
    return (rowCount ?? 0) > 0;
  }

  async update(meetupId: string, changes: MeetupChanges): Promise<boolean> {
    // Only the columns being changed appear in SET (names are fixed here,
    // values are parameters). RLS limits the row to the creator's own.
    const sets: string[] = [];
    const params: unknown[] = [meetupId];
    if (changes.title !== undefined) {
      params.push(changes.title);
      sets.push(`title = $${params.length}`);
    }
    if (changes.startsAt !== undefined) {
      params.push(changes.startsAt.toISOString());
      sets.push(`starts_at = $${params.length}`);
    }
    if (sets.length > 0) {
      const { rowCount } = await this.db.query(
        `update public.meetups set ${sets.join(', ')} where id = $1`,
        params,
      );
      if ((rowCount ?? 0) === 0) return false;
    }
    if (changes.meetingPoint) {
      // A coordinate change makes the database recompute the approximate area.
      const { rowCount } = await this.db.query(
        `update public.meetup_meeting_points
            set place_name = $2, latitude = $3, longitude = $4
          where meetup_id = $1`,
        [
          meetupId,
          changes.meetingPoint.placeName,
          changes.meetingPoint.latitude,
          changes.meetingPoint.longitude,
        ],
      );
      if ((rowCount ?? 0) === 0) return false;
    }
    return true;
  }
}
