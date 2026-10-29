import type { Group } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../ui/theme';

interface Props {
  groups: Group[];
  selectedId: string | undefined;
  onSelect: (groupId: string) => void;
  compact?: boolean;
}

/** Horizontal chips fed by the "my groups" endpoint. */
export function GroupPicker({ groups, selectedId, onSelect, compact = false }: Props) {
  return (
    <ScrollView
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
    >
      {groups.map((group) => {
        const selected = group.id === selectedId;
        return (
          <Pressable
            key={group.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            testID={`group-chip-${group.id}`}
            onPress={() => onSelect(group.id)}
            style={[styles.chip, compact && styles.compactChip, selected && styles.chipSelected]}
          >
            {!compact ? (
              <Ionicons
                name="people"
                size={26}
                color={selected ? colors.onPrimary : colors.primary}
                style={styles.icon}
              />
            ) : null}
            <Text style={[styles.text, selected && styles.textSelected]}>{group.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.secondaryStrong,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 120,
    width: 122,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  compactChip: { minHeight: 42, width: 'auto', borderRadius: radius.pill },
  icon: { marginBottom: spacing.md },
  text: { ...typography.label, color: colors.primary, textAlign: 'center' },
  textSelected: { color: colors.onPrimary },
});
