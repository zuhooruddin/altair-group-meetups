import type { CreateMeetupRequest, MeetupDetail, UpdateMeetupRequest } from '@altair/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '../../core/services';
import { queryKeys } from '../query-keys';

export function useGroupMeetups(groupId: string | undefined) {
  const { meetups } = useServices();
  return useQuery({
    queryKey: queryKeys.groupMeetups(groupId ?? 'none'),
    queryFn: () => meetups.listForGroup(groupId!),
    enabled: !!groupId,
  });
}

export function useMeetupDetail(meetupId: string) {
  const { meetups } = useServices();
  return useQuery({ queryKey: queryKeys.meetup(meetupId), queryFn: () => meetups.get(meetupId) });
}

/**
 * Every write returns the fresh meetup detail as the server now sees it for
 * this member (including the meeting point they may now see). Put it in the
 * cache directly so the detail and its map update at once, and refresh the
 * group list in the background.
 */
function useApplyMeetupDetail() {
  const queryClient = useQueryClient();
  return (detail: MeetupDetail) => {
    queryClient.setQueryData(queryKeys.meetup(detail.id), detail);
    void queryClient.invalidateQueries({ queryKey: queryKeys.groupMeetups(detail.groupId) });
  };
}

export function useCreateMeetup() {
  const { meetups } = useServices();
  const apply = useApplyMeetupDetail();
  return useMutation({
    mutationFn: (input: CreateMeetupRequest) => meetups.create(input),
    onSuccess: apply,
  });
}

export function useCancelMeetup(meetupId: string) {
  const { meetups } = useServices();
  const apply = useApplyMeetupDetail();
  return useMutation({ mutationFn: () => meetups.cancel(meetupId), onSuccess: apply });
}

export function useUpdateMeetup(meetupId: string) {
  const { meetups } = useServices();
  const apply = useApplyMeetupDetail();
  return useMutation({
    mutationFn: (changes: UpdateMeetupRequest) => meetups.update(meetupId, changes),
    onSuccess: apply,
  });
}

export function useRsvp(meetupId: string) {
  const { meetups } = useServices();
  const apply = useApplyMeetupDetail();
  return useMutation({ mutationFn: () => meetups.rsvp(meetupId), onSuccess: apply });
}

export function useWithdrawRsvp(meetupId: string) {
  const { meetups } = useServices();
  const apply = useApplyMeetupDetail();
  return useMutation({ mutationFn: () => meetups.withdraw(meetupId), onSuccess: apply });
}
