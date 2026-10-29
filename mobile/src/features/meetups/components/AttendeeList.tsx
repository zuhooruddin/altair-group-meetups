import type { Attendee } from '@altair/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../../ui/theme';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function AttendeeList({
  attendees,
  currentUserId,
}: {
  attendees: Attendee[];
  currentUserId: string | null;
}) {
  if (attendees.length === 0) {
    return <Text style={styles.empty}>No one has RSVP’d yet.</Text>;
  }
  return (
    <View style={styles.list} testID="attendee-list">
      {attendees.map((a) => (
        <View key={a.userId} style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(a.displayName)}</Text>
          </View>
          <Text style={styles.name}>
            {a.displayName}
            {a.userId === currentUserId ? <Text style={styles.you}> (you)</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.label, color: colors.primary },
  name: { ...typography.body, color: colors.text },
  you: { color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted },
});
