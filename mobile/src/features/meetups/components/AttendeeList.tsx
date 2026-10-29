import type { Attendee } from '@altair/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../../ui/theme';
import { Avatar } from '../../../ui/Avatar';

export function AttendeeList({
  attendees,
  currentUserId,
  hostUserId,
}: {
  attendees: Attendee[];
  currentUserId: string | null;
  hostUserId?: string;
}) {
  if (attendees.length === 0) {
    return <Text style={styles.empty}>No one has RSVP’d yet.</Text>;
  }
  return (
    <View style={styles.list} testID="attendee-list">
      {attendees.map((a) => (
        <View key={a.userId} style={styles.row}>
          <Avatar userId={a.userId} name={a.displayName} size={48} />
          <Text style={styles.name}>
            {a.displayName}
            {a.userId === currentUserId ? <Text style={styles.you}> (you)</Text> : null}
          </Text>
          {a.userId === hostUserId ? <Text style={styles.host}>Host</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  row: { alignItems: 'center', gap: spacing.sm, width: 84 },
  host: { ...typography.caption, color: colors.primary, fontWeight: '600', marginTop: -spacing.xs },
  name: { ...typography.caption, color: colors.text, textAlign: 'center' },
  you: { color: colors.textMuted },
  empty: { ...typography.body, color: colors.textMuted },
});
