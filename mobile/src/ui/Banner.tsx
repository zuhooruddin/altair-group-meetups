import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

type Tone = 'error' | 'success' | 'info' | 'warning';

const tones: Record<Tone, { bg: string; fg: string }> = {
  error: { bg: colors.dangerSoft, fg: colors.danger },
  success: { bg: colors.successSoft, fg: colors.success },
  info: { bg: colors.accentSoft, fg: colors.accent },
  warning: { bg: colors.warningSoft, fg: colors.warning },
};

/** Inline feedback message (success, error...). Announced by screen readers. */
export function Banner({
  tone,
  message,
  testID,
}: {
  tone: Tone;
  message: string;
  testID?: string;
}) {
  const t = tones[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: t.bg }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Text style={[styles.text, { color: t.fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  text: { ...typography.body, fontSize: 14 },
});
