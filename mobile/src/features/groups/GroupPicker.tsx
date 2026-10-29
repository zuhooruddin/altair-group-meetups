import type { Group } from '@altair/shared';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '../../ui/theme';

interface Props {
  groups: Group[];
  selectedId: string | undefined;
  onSelect: (groupId: string) => void;
}

/** Horizontal chips fed by the "my groups" endpoint. */
export function GroupPicker({ groups, selectedId, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
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
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{group.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.secondaryStrong,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { ...typography.label, color: colors.primary },
  textSelected: { color: colors.onPrimary },
});
