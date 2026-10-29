import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

type Tone = 'neutral' | 'success' | 'warning' | 'accent';

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.secondary, fg: colors.primary },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  accent: { bg: colors.accentSoft, fg: colors.accent },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  text: { ...typography.label, fontSize: 12 },
});
