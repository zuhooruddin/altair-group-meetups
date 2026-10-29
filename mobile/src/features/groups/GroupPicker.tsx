import type { Group } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../ui/theme';

interface Props {
  groups: Group[];
  selectedId: string | undefined;
  onSelect: (groupId: string) => void;
  compact?: boolean;
}

/** Horizontal chips fed by the "my groups" endpoint. */
export function GroupPicker({ groups, selectedId, onSelect, compact = false }: Props) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(156, Math.min(240, (width - spacing.lg * 2 - spacing.md) / 2));
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
            style={[
              styles.chip,
              !compact && { width: cardWidth, minHeight: cardWidth },
              compact && styles.compactChip,
              selected && styles.chipSelected,
            ]}
          >
            {!compact ? (
              <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
                <Ionicons name="people" size={30} color={colors.primary} />
              </View>
            ) : null}
            {!compact && selected ? (
              <View style={styles.check}>
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              </View>
            ) : null}
            <Text
              style={[styles.text, compact && styles.compactText, selected && styles.textSelected]}
            >
              {group.name}
            </Text>
            {!compact ? (
              <View
                style={styles.landscape}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={[styles.hillBack, selected && styles.hillBackSelected]} />
                <View style={[styles.hillFront, selected && styles.hillFrontSelected]} />
                {!selected ? <View style={styles.path} /> : null}
                <View style={styles.trees}>
                  <Ionicons name="triangle" size={28} color={selected ? '#28856B' : '#B6D7C0'} />
                  <Ionicons name="triangle" size={45} color={selected ? '#328F72' : '#B6D7C0'} />
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: '#D3E4D7',
    backgroundColor: '#F6FAF5',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 54,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: '#248267' },
  compactChip: {
    minHeight: 42,
    width: 'auto',
    borderRadius: radius.pill,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    justifyContent: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E0EDDF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircleSelected: { backgroundColor: '#FAF8F1' },
  check: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.heading,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
    color: '#102F27',
  },
  textSelected: { color: colors.onPrimary },
  compactText: { ...typography.label, lineHeight: 18 },
  landscape: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 55, overflow: 'hidden' },
  hillBack: {
    position: 'absolute',
    width: '130%',
    height: 70,
    borderRadius: 100,
    backgroundColor: '#E0EEDD',
    left: -45,
    bottom: -35,
    transform: [{ rotate: '13deg' }],
  },
  hillFront: {
    position: 'absolute',
    width: '130%',
    height: 60,
    borderRadius: 100,
    backgroundColor: '#D0E4D2',
    right: -45,
    bottom: -32,
    transform: [{ rotate: '-12deg' }],
  },
  hillBackSelected: { backgroundColor: '#1C765E' },
  hillFrontSelected: { backgroundColor: '#12664F' },
  path: {
    position: 'absolute',
    width: 90,
    height: 9,
    borderRadius: 20,
    backgroundColor: '#F8FBF5',
    bottom: 18,
    right: 18,
    transform: [{ rotate: '-15deg' }],
  },
  trees: {
    position: 'absolute',
    bottom: 15,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 0,
  },
});
