export const queryKeys = {
  myGroups: ['groups', 'mine'] as const,
  groupMeetups: (groupId: string) => ['groups', groupId, 'meetups'] as const,
  meetup: (meetupId: string) => ['meetups', meetupId] as const,
};
