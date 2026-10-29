import type { MeetupDetail } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  ImageBackground,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { messageFor } from '../../../core/api/api-error';
import type { ScreenProps } from '../../../navigation/types';
import { Badge } from '../../../ui/Badge';
import { Avatar } from '../../../ui/Avatar';
import { artwork } from '../../../ui/artwork';
import { Banner } from '../../../ui/Banner';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';
import { ErrorState, LoadingState } from '../../../ui/StateViews';
import { colors, spacing, typography } from '../../../ui/theme';
import { useCurrentUserId } from '../../auth/AuthProvider';
import { AttendeeList } from '../components/AttendeeList';
import { MeetingPointMap } from '../components/MeetingPointMap';
import { formatCoordinate, formatDayTime, pluralize } from '../format';
import { useCancelMeetup, useMeetupDetail, useRsvp, useWithdrawRsvp } from '../hooks';

type Feedback = { tone: 'success' | 'error'; message: string } | null;

const flashMessages = {
  created: 'Meetup created. Your group can see it now.',
  updated: 'Changes saved.',
} as const;

export function MeetupDetailScreen({ route, navigation }: ScreenProps<'MeetupDetail'>) {
  const { meetupId, flash } = route.params;
  const query = useMeetupDetail(meetupId);
  const currentUserId = useCurrentUserId();
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Show a one-off confirmation when we arrive from create or edit.
  useEffect(() => {
    if (flash) setFeedback({ tone: 'success', message: flashMessages[flash] });
  }, [flash]);

  if (query.isPending) return <LoadingState message="Loading meetup…" />;
  if (query.isError)
    return <ErrorState message={messageFor(query.error)} onRetry={() => query.refetch()} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }
      testID="meetup-detail"
    >
      <MeetupHeader meetup={query.data} />
      {feedback ? (
        <Banner tone={feedback.tone} message={feedback.message} testID="detail-feedback" />
      ) : null}
      <MeetingPointSection meetup={query.data} />
      <RsvpSection meetup={query.data} onFeedback={setFeedback} />
      <Card style={styles.detailCard}>
        <Text style={styles.sectionTitle}>
          Who’s going <Text style={styles.muted}>({query.data.attendees.length})</Text>
        </Text>
        <AttendeeList
          attendees={query.data.attendees}
          currentUserId={currentUserId}
          hostUserId={query.data.creator.id}
        />
      </Card>
      {query.data.status === 'scheduled' && query.data.meetingPoint.visibility === 'exact' ? (
        <Button
          label="Live walk (demo)"
          variant="ghost"
          onPress={() => navigation.navigate('LiveWalk', { meetupId })}
          testID="live-walk-button"
        />
      ) : null}
      {query.data.viewer.canEdit ? (
        <Button
          label="Edit meetup"
          variant="secondary"
          onPress={() => navigation.navigate('EditMeetup', { meetupId })}
          testID="edit-button"
        />
      ) : null}
      {query.data.viewer.canCancel ? (
        <CancelSection meetup={query.data} onFeedback={setFeedback} />
      ) : null}
    </ScrollView>
  );
}

function MeetupHeader({ meetup }: { meetup: MeetupDetail }) {
  const cancelled = meetup.status === 'cancelled';
  return (
    <View style={styles.header}>
      <ImageBackground source={artwork.meetup} style={styles.cover} imageStyle={styles.coverImage}>
        {cancelled ? <View style={styles.cancelledCoverTint} /> : null}
        <View style={[styles.coverStatus, cancelled && styles.coverStatusCancelled]}>
          <Text style={styles.coverStatusText}>{cancelled ? 'Cancelled' : 'Scheduled'}</Text>
        </View>
      </ImageBackground>
      <Text style={[styles.title, cancelled && styles.struck]} testID="detail-title">
        {meetup.title}
      </Text>
      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
        <Text style={styles.meta}>{formatDayTime(meetup.startsAt)}</Text>
      </View>
      {meetup.meetingPoint.visibility === 'exact' ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text style={styles.meta}>{meetup.meetingPoint.placeName}</Text>
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Avatar userId={meetup.creator.id} name={meetup.creator.displayName} size={24} />
        <Text style={styles.meta}>
          {meetup.viewer.isCreator ? 'You’re hosting' : `Hosted by ${meetup.creator.displayName}`}
        </Text>
      </View>
      {meetup.viewer.isCreator || meetup.viewer.isAttending ? (
        <View style={styles.badges}>
          {meetup.viewer.isCreator ? <Badge label="Your meetup" tone="accent" /> : null}
          {meetup.viewer.isAttending ? <Badge label="You're going" tone="success" /> : null}
        </View>
      ) : null}
      {cancelled ? (
        <View
          style={styles.cancelNotice}
          testID="cancelled-banner"
          accessibilityLiveRegion="polite"
        >
          <Ionicons name="alert-circle" size={32} color={colors.danger} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>This meetup was cancelled by its host.</Text>
            <Text style={styles.noticeText}>
              It no longer accepts RSVPs. Existing attendees can still withdraw.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MeetingPointSection({ meetup }: { meetup: MeetupDetail }) {
  const point = meetup.meetingPoint;
  return (
    <Card style={styles.detailCard}>
      <Text style={styles.sectionTitle}>Meeting point</Text>
      <MeetingPointMap point={point} height={180} />
      {point.visibility === 'exact' ? (
        <View style={styles.pointInfo} testID="exact-point-info">
          <Text style={styles.placeName}>{point.placeName}</Text>
          <Text style={styles.muted}>
            {formatCoordinate(point.latitude)}, {formatCoordinate(point.longitude)}
          </Text>
        </View>
      ) : (
        <View style={styles.pointInfo} testID="approximate-point-info">
          <Text style={styles.placeName}>Somewhere in the highlighted area</Text>
          <Text style={styles.muted}>
            The exact spot and place name are shared with members who RSVP. This keeps where
            neighbors gather private to the people actually coming.
          </Text>
        </View>
      )}
    </Card>
  );
}

function RsvpSection({
  meetup,
  onFeedback,
}: {
  meetup: MeetupDetail;
  onFeedback: (f: Feedback) => void;
}) {
  const rsvp = useRsvp(meetup.id);
  const withdraw = useWithdrawRsvp(meetup.id);
  const { viewer } = meetup;

  const doRsvp = () =>
    rsvp.mutate(undefined, {
      onSuccess: () =>
        onFeedback({
          tone: 'success',
          message: 'You’re going! The exact meeting point is now on the map.',
        }),
      onError: (e) => onFeedback({ tone: 'error', message: messageFor(e) }),
    });
  const doWithdraw = () =>
    withdraw.mutate(undefined, {
      onSuccess: () => onFeedback({ tone: 'success', message: 'Your RSVP was withdrawn.' }),
      onError: (e) => onFeedback({ tone: 'error', message: messageFor(e) }),
    });

  let status: string;
  if (viewer.isAttending) status = 'You’re going.';
  else if (meetup.status === 'cancelled') status = 'This meetup is cancelled.';
  else if (!viewer.canRsvp) status = 'This meetup has started; RSVPs are closed.';
  else status = `${pluralize(meetup.attendeeCount, 'neighbor is', 'neighbors are')} going.`;

  return (
    <Card style={styles.detailCard}>
      <Text style={styles.sectionTitle}>
        {meetup.status === 'cancelled' ? 'Your RSVP' : 'About this walk'}
      </Text>
      {meetup.status === 'scheduled' ? (
        <Text style={styles.walkIntro}>
          A little fresh air with your neighborhood walking group.
        </Text>
      ) : null}
      <Text style={[styles.body, viewer.isAttending && styles.going]} testID="rsvp-status">
        {status}
      </Text>
      <View style={styles.actions}>
        {!viewer.canRsvp && !viewer.isAttending ? (
          <View style={styles.closedRsvp} accessibilityState={{ disabled: true }}>
            <Text style={styles.closedRsvpText}>Cannot RSVP</Text>
          </View>
        ) : null}
        {viewer.canRsvp ? (
          <Button
            label="RSVP — I’m going"
            onPress={doRsvp}
            loading={rsvp.isPending}
            testID="rsvp-button"
          />
        ) : null}
        {viewer.isAttending ? (
          <Button
            label="Withdraw RSVP"
            variant="secondary"
            onPress={doWithdraw}
            loading={withdraw.isPending}
            testID="withdraw-button"
          />
        ) : null}
      </View>
    </Card>
  );
}

function CancelSection({
  meetup,
  onFeedback,
}: {
  meetup: MeetupDetail;
  onFeedback: (f: Feedback) => void;
}) {
  const cancel = useCancelMeetup(meetup.id);
  const confirm = () =>
    Alert.alert(
      'Cancel this meetup?',
      'Everyone in the group will see it as cancelled. This can’t be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel meetup',
          style: 'destructive',
          onPress: () =>
            cancel.mutate(undefined, {
              onSuccess: () => onFeedback({ tone: 'success', message: 'Meetup cancelled.' }),
              onError: (e) => onFeedback({ tone: 'error', message: messageFor(e) }),
            }),
        },
      ],
      { cancelable: true },
    );
  return (
    <View style={styles.cancelArea}>
      <Button
        label="Cancel meetup"
        variant="danger"
        onPress={confirm}
        loading={cancel.isPending}
        testID="cancel-button"
      />
      <Text style={styles.cancelHint}>Only you, as the host, can cancel.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.sm, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.sm, paddingBottom: spacing.xs },
  detailCard: {
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  cover: {
    aspectRatio: 1.85,
    padding: spacing.md,
    marginBottom: spacing.xs,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.secondary,
  },
  coverImage: { borderRadius: 16 },
  cancelledCoverTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(239,137,44,0.2)',
  },
  coverStatus: {
    alignSelf: 'flex-start',
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.primary,
  },
  coverStatusCancelled: { backgroundColor: colors.danger },
  coverStatusText: { ...typography.label, color: colors.onPrimary },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  title: { ...typography.display, fontSize: 22, color: colors.text, paddingHorizontal: spacing.xs },
  struck: { color: colors.text },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  meta: { ...typography.caption, fontSize: 13, lineHeight: 18, color: colors.textMuted, flex: 1 },
  sectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.sm },
  pointInfo: { marginTop: spacing.md, gap: 2 },
  placeName: { ...typography.label, color: colors.text },
  muted: { ...typography.caption, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  body: { ...typography.body, color: colors.text },
  going: { color: colors.success, fontWeight: '600' },
  walkIntro: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  cancelNotice: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: '#FFE9E5',
    borderRadius: 18,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  noticeCopy: { flex: 1, gap: spacing.sm },
  noticeTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20, color: colors.danger },
  noticeText: { ...typography.caption, lineHeight: 18, color: '#754C45' },
  closedRsvp: {
    height: 46,
    borderRadius: 13,
    backgroundColor: '#E8E8E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closedRsvpText: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  cancelArea: { gap: spacing.sm, alignItems: 'stretch' },
  cancelHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});
