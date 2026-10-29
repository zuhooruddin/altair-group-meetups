import type {
  CreateMeetupRequest,
  Group,
  MeetupDetail,
  MeetupSummary,
  UpdateMeetupRequest,
} from '@altair/shared';

/**
 * What the app's features depend on. Screens and hooks never see Supabase
 * or fetch directly; the composition root (App.tsx) wires real adapters,
 * tests wire fakes.
 */
export interface AuthSession {
  userId: string;
  email: string | null;
}

export interface AuthGateway {
  currentSession(): Promise<AuthSession | null>;
  signIn(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  /** Returns an unsubscribe function. */
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
  /** A fresh access token for API calls, or null when signed out. */
  accessToken(): Promise<string | null>;
}

export interface GroupsGateway {
  listMine(): Promise<Group[]>;
}

export interface MeetupsGateway {
  listForGroup(groupId: string): Promise<MeetupSummary[]>;
  get(meetupId: string): Promise<MeetupDetail>;
  create(input: CreateMeetupRequest): Promise<MeetupDetail>;
  cancel(meetupId: string): Promise<MeetupDetail>;
  /** Bonus: creator-only edit. */
  update(meetupId: string, changes: UpdateMeetupRequest): Promise<MeetupDetail>;
  rsvp(meetupId: string): Promise<MeetupDetail>;
  withdraw(meetupId: string): Promise<MeetupDetail>;
}

export interface AppServices {
  auth: AuthGateway;
  groups: GroupsGateway;
  meetups: MeetupsGateway;
}
