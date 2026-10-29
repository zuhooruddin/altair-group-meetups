import { createMeetupRequestSchema } from '@altair/shared';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { ApiError, messageFor } from '../../../core/api/api-error';
import type { ScreenProps } from '../../../navigation/types';
import { Banner } from '../../../ui/Banner';
import { Button } from '../../../ui/Button';
import { colors, spacing } from '../../../ui/theme';
import { useMyGroups } from '../../groups/hooks';
import { MeetupFormFields, useMeetupForm } from '../components/MeetupForm';
import { useCreateMeetup } from '../hooks';

function tomorrowAtNine(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function CreateMeetupScreen({ route, navigation }: ScreenProps<'CreateMeetup'>) {
  const groups = useMyGroups();
  const create = useCreateMeetup();
  const form = useMeetupForm({ groupId: route.params.groupId, startsAt: tomorrowAtNine() });

  const submit = () => {
    form.clearErrors();
    // Same schema the server validates with; the server re-checks everything.
    const parsed = createMeetupRequestSchema.safeParse(form.draft());
    if (!parsed.success) {
      form.showIssues(
        parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: (meetup) =>
        navigation.replace('MeetupDetail', { meetupId: meetup.id, flash: 'created' }),
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
        testID="create-meetup"
      >
        <MeetupFormFields form={form} {...(groups.data ? { groups: groups.data } : {})} />
        {form.serverError ? (
          <Banner tone="error" message={form.serverError} testID="create-error" />
        ) : null}
        <Button
          label="Create meetup"
          onPress={submit}
          loading={create.isPending}
          testID="create-submit"
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
