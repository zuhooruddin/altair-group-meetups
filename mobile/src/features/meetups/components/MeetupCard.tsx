import type { MeetupSummary } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../ui/Badge';
import { Avatar } from '../../../ui/Avatar';
import { Card } from '../../../ui/Card';
import { colors, spacing, typography } from '../../../ui/theme';
import { formatDay, formatTime, pluralize } from '../format';
import { useMeetupDetail } from '../hooks';

interface Props {
  meetup: MeetupSummary;
  onPress: (meetup: MeetupSummary) => void;
}

function MeetupCardView({ meetup, onPress }: Props) {
  const detail = useMeetupDetail(meetup.id);
  const attendees = detail.data?.id === meetup.id ? detail.data.attendees : [];
  const cancelled = meetup.status === 'cancelled';
  const location =
    meetup.meetingPoint.visibility === 'exact'
      ? meetup.meetingPoint.placeName
      : 'Approximate area · RSVP to see the spot';

  return (
    <Card
      onPress={() => onPress(meetup)}
      accessibilityLabel={`${meetup.title}, ${formatDay(meetup.startsAt)} at ${formatTime(meetup.startsAt)}${cancelled ? ', cancelled' : ''}`}
      testID={`meetup-card-${meetup.id}`}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={[styles.dateBlock, cancelled && styles.cancelledDate]}>
          <Text style={[styles.weekday, cancelled && styles.cancelledText]}>
            {new Date(meetup.startsAt)
              .toLocaleDateString('en-US', { weekday: 'short' })
              .toUpperCase()}
          </Text>
          <Text style={[styles.day, cancelled && styles.cancelledText]}>
            {new Date(meetup.startsAt).getDate()}
          </Text>
          <Text style={[styles.month, cancelled && styles.cancelledText]}>
            {new Date(meetup.startsAt)
              .toLocaleDateString('en-US', { month: 'short' })
              .toUpperCase()}
          </Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, cancelled && styles.struck]} numberOfLines={2}>
            {meetup.title}
          </Text>
          <View style={styles.meta}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{formatTime(meetup.startsAt)}</Text>
          </View>
          <View style={styles.meta}>
            <Ionicons
              name={
                meetup.meetingPoint.visibility === 'exact'
                  ? 'location-outline'
                  : 'scan-circle-outline'
              }
              size={14}
              color={colors.textMuted}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {location}
            </Text>
          </View>
          <View style={styles.badges}>
            {cancelled ? (
              <Badge label="Cancelled" tone="warning" />
            ) : (
              <Badge label="Scheduled" tone="neutral" />
            )}
            {meetup.viewer.isCreator ? <Badge label="Your meetup" tone="accent" /> : null}
            {meetup.viewer.isAttending ? <Badge label="You’re going" tone="success" /> : null}
          </View>
          <View style={styles.attendance}>
            <View style={styles.avatarStack}>
              {attendees.slice(0, 3).map((attendee, index) => (
                <View
                  key={attendee.userId}
                  style={index > 0 ? styles.overlappingAvatar : undefined}
                >
                  <Avatar userId={attendee.userId} name={attendee.displayName} size={26} />
                </View>
              ))}
              {attendees.length > 3 ? (
                <Text style={styles.moreAttendees}>+{attendees.length - 3}</Text>
              ) : null}
              {attendees.length === 0 ? (
                <Ionicons name="people-outline" size={20} color={colors.textMuted} />
              ) : null}
            </View>
            <Text style={styles.count}>
              {pluralize(
                meetup.attendeeCount,
                cancelled ? 'was going' : 'going',
                cancelled ? 'were going' : 'going',
              )}
            </Text>
          </View>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textMuted}
          style={styles.chevron}
        />
      </View>
    </Card>
  );
}

export const MeetupCard = memo(MeetupCardView);

const styles = StyleSheet.create({
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  overlappingAvatar: { marginLeft: -6 },
  moreAttendees: { ...typography.caption, color: colors.textMuted, marginLeft: spacing.xs },
  card: { padding: spacing.md, borderRadius: 18, borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  row: { flexDirection: 'row', gap: spacing.md },
  dateBlock: {
    width: 54,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E1F7EE',
    borderRadius: 12,
    paddingVertical: spacing.sm,
  },
  weekday: { fontSize: 11, fontWeight: '600', color: colors.primary },
  cancelledDate: { backgroundColor: colors.warningSoft },
  cancelledText: { color: colors.danger },
  day: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
    marginVertical: 2,
  },
  month: { fontSize: 11, color: colors.primary },
  chevron: { alignSelf: 'flex-start', marginTop: 24, marginLeft: -spacing.sm },
  body: { flex: 1, gap: spacing.xs },
  title: { ...typography.heading, fontSize: 15, color: colors.text, marginBottom: 2 },
  struck: { color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2 },
  count: { ...typography.caption, color: colors.textMuted },
  attendance: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  peopleIcon: {
    height: 24,
    width: 28,
    borderRadius: 14,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
