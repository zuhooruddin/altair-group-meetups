import type { MeetupSummary } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../ui/Badge';
import { Card } from '../../../ui/Card';
import { colors, spacing, typography } from '../../../ui/theme';
import { formatDay, formatTime, pluralize } from '../format';

interface Props {
  meetup: MeetupSummary;
  onPress: (meetup: MeetupSummary) => void;
}

function MeetupCardView({ meetup, onPress }: Props) {
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
      style={cancelled ? styles.cancelledCard : undefined}
    >
      <View style={styles.row}>
        <View style={styles.dateBlock}>
          <Text style={styles.day}>{formatDay(meetup.startsAt)}</Text>
          <Text style={styles.time}>{formatTime(meetup.startsAt)}</Text>
        </View>
        <View style={styles.body}>
          <Text style={[styles.title, cancelled && styles.struck]} numberOfLines={2}>
            {meetup.title}
          </Text>
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
            <Text style={styles.count}>{pluralize(meetup.attendeeCount, 'going', 'going')}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

export const MeetupCard = memo(MeetupCardView);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  dateBlock: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    borderRadius: 12,
    paddingVertical: spacing.sm,
  },
  day: { ...typography.label, color: colors.primary, textAlign: 'center' },
  time: { ...typography.caption, color: colors.primary, marginTop: 2 },
  body: { flex: 1, gap: spacing.xs + 2 },
  title: { ...typography.heading, color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textMuted, flex: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs + 2 },
  count: { ...typography.caption, color: colors.textMuted },
  cancelledCard: { backgroundColor: '#FBFAF6' },
});
