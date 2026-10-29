import {
  updateMeetupRequestSchema,
  type MeetupDetail,
  type UpdateMeetupInput,
} from '@altair/shared';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { ApiError, messageFor } from '../../../core/api/api-error';
import type { ScreenProps } from '../../../navigation/types';
import { Banner } from '../../../ui/Banner';
import { Button } from '../../../ui/Button';
import { ErrorState, LoadingState } from '../../../ui/StateViews';
import { colors, spacing } from '../../../ui/theme';
import { MeetupFormFields, useMeetupForm } from '../components/MeetupForm';
import { useMeetupDetail, useUpdateMeetup } from '../hooks';

/** Bonus: creator-only edit. The server enforces creator-only; the app only hides the entry point. */
export function EditMeetupScreen({ route, navigation }: ScreenProps<'EditMeetup'>) {
  const query = useMeetupDetail(route.params.meetupId);

  if (query.isPending) return <LoadingState message="Loading meetup…" />;
  if (query.isError) {
    return <ErrorState message={messageFor(query.error)} onRetry={() => query.refetch()} />;
  }
  if (!query.data.viewer.canEdit || query.data.meetingPoint.visibility !== 'exact') {
    return <ErrorState message="Only the host can edit a scheduled meetup." />;
  }
  return (
    <EditForm
      meetup={query.data}
      onSaved={() =>
        navigation.popTo('MeetupDetail', { meetupId: query.data.id, flash: 'updated' })
      }
    />
  );
}

function EditForm({ meetup, onSaved }: { meetup: MeetupDetail; onSaved: () => void }) {
  const update = useUpdateMeetup(meetup.id);
  const point = meetup.meetingPoint.visibility === 'exact' ? meetup.meetingPoint : null;
  const form = useMeetupForm({
    title: meetup.title,
    startsAt: new Date(meetup.startsAt),
    placeName: point?.placeName ?? '',
    ...(point ? { latitude: point.latitude, longitude: point.longitude } : {}),
  });

  const submit = () => {
    form.clearErrors();
    const draft = form.draft();
    // Send only what changed; an unchanged start time is never re-validated.
    const changes: UpdateMeetupInput = {};
    if (draft.title.trim() !== meetup.title) changes.title = draft.title;
    if (Date.parse(draft.startsAt) !== Date.parse(meetup.startsAt))
      changes.startsAt = draft.startsAt;
    if (
      !point ||
      draft.meetingPoint.placeName.trim() !== point.placeName ||
      draft.meetingPoint.latitude !== point.latitude ||
      draft.meetingPoint.longitude !== point.longitude
    ) {
      changes.meetingPoint = draft.meetingPoint;
    }
    if (Object.keys(changes).length === 0) {
      form.setServerError('Nothing has changed yet.');
      return;
    }
    const parsed = updateMeetupRequestSchema.safeParse(changes);
    if (!parsed.success) {
      form.showIssues(
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: onSaved,
      onError: (error) => {
        if (error instanceof ApiError && error.issues.length > 0) form.showIssues(error.issues);
        form.setServerError(messageFor(error));
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID="edit-meetup"
      >
        <MeetupFormFields form={form} />
        {form.serverError ? (
          <Banner tone="error" message={form.serverError} testID="edit-error" />
        ) : null}
        <Button
          label="Save changes"
          onPress={submit}
          loading={update.isPending}
          testID="edit-submit"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
});
