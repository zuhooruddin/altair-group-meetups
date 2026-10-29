import type {
  Actor,
  AttendeeRecord,
  GroupRecord,
  MeetupChanges,
  MeetupRecord,
  NewMeetup,
} from './types';

/**
 * Data-access ports. Implementations run every query AS the member (their
 * identity is bound to the transaction), so row-level security in Postgres
 * decides what each method can see or change. Services never pass a user id
 * for authorisation; they only ever get back what the member may see.
 */
export interface GroupRepository {
  /** The caller's own groups. */
  listMine(): Promise<GroupRecord[]>;
  /** The group if the caller is a member, otherwise null. */
  findVisible(groupId: string): Promise<GroupRecord | null>;
}

export interface MeetupRepository {
  /** A group's meetups visible to the caller, soonest first, cancelled included. */
  listByGroup(groupId: string): Promise<MeetupRecord[]>;
  findVisible(meetupId: string): Promise<MeetupRecord | null>;
  /** Creates as the caller (creator comes from the session). Returns the new id. */
  create(input: NewMeetup): Promise<string>;
  /** Cancels if the caller is the creator and it is still scheduled. True if a row changed. */
  cancel(meetupId: string): Promise<boolean>;
  /** Bonus edit, as the caller (RLS: creator only). True if the caller could change it. */
  update(meetupId: string, changes: MeetupChanges): Promise<boolean>;
}

export interface RsvpRepository {
  listAttendees(meetupId: string): Promise<AttendeeRecord[]>;
  /** RSVPs the caller. Idempotent. */
  addForCaller(meetupId: string): Promise<void>;
  /** Withdraws the caller's RSVP. True if one existed. */
  removeForCaller(meetupId: string): Promise<boolean>;
}

export interface Repositories {
  groups: GroupRepository;
  meetups: MeetupRepository;
  rsvps: RsvpRepository;
}

/**
 * Runs work in one transaction bound to the member's identity.
 *  - read:  as the client-facing `authenticated` role, read-only.
 *  - write: as `altair_api_writer`, the only role with write grants.
 */
export interface UnitOfWork {
  read<T>(actor: Actor, work: (repos: Repositories) => Promise<T>): Promise<T>;
  write<T>(actor: Actor, work: (repos: Repositories) => Promise<T>): Promise<T>;
}

/** Verifies a Supabase access token. Returns null when it is not valid. */
export interface TokenVerifier {
  verify(accessToken: string): Promise<Actor | null>;
}
