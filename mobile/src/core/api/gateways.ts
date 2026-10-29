import {
  apiRoutes,
  listMeetupsResponseSchema,
  meetupDetailResponseSchema,
  myGroupsResponseSchema,
  type CreateMeetupRequest,
} from '@altair/shared';
import type { GroupsGateway, MeetupsGateway } from '../ports';
import type { ApiClient } from './api-client';

/** Reads and writes both go through the API; the app never writes to Supabase tables. */
export function createGroupsGateway(api: ApiClient): GroupsGateway {
  return {
    listMine: async () => (await api.request('GET', apiRoutes.myGroups, myGroupsResponseSchema)).groups,
  };
}

export function createMeetupsGateway(api: ApiClient): MeetupsGateway {
  const detail = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) =>
    (await api.request(method, path, meetupDetailResponseSchema, body)).meetup;

  return {
    listForGroup: async (groupId) =>
      (await api.request('GET', apiRoutes.groupMeetups(groupId), listMeetupsResponseSchema)).meetups,
    get: (meetupId) => detail('GET', apiRoutes.meetup(meetupId)),
    create: (input: CreateMeetupRequest) => detail('POST', apiRoutes.meetups, input),
    cancel: (meetupId) => detail('POST', apiRoutes.cancelMeetup(meetupId)),
    rsvp: (meetupId) => detail('PUT', apiRoutes.rsvp(meetupId)),
    withdraw: (meetupId) => detail('DELETE', apiRoutes.rsvp(meetupId)),
  };
}
