import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from './theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;
  const palette = variants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.withArrow,
        {
          backgroundColor: pressed ? palette.pressed : palette.background,
          borderColor: palette.border,
        },
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
          {variant === 'primary' ? (
            <Ionicons name="arrow-forward" size={21} color={palette.text} style={styles.arrow} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

const variants: Record<
  Variant,
  { background: string; pressed: string; text: string; border: string }
> = {
  primary: {
    background: colors.primary,
    pressed: colors.primaryPressed,
    text: colors.onPrimary,
    border: colors.primary,
  },
  secondary: {
    background: colors.surface,
    pressed: colors.secondary,
    text: colors.primary,
    border: colors.secondaryStrong,
  },
  danger: {
    background: colors.surface,
    pressed: colors.dangerSoft,
    text: colors.danger,
    border: colors.danger,
  },
  ghost: {
    background: 'transparent',
    pressed: colors.secondary,
    text: colors.primary,
    border: 'transparent',
  },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.heading },
  withArrow: { paddingHorizontal: spacing.xl + 24 },
  arrow: { position: 'absolute', right: spacing.lg },
  inactive: { opacity: 0.55 },
});
