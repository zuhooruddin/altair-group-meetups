import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../../ui/theme';
import { formatDay, formatTime } from '../format';

interface Props {
  label: string;
  value: Date;
  onChange: (value: Date) => void;
  error?: string | undefined;
}

/** Date + start time. Android uses the native dialogs, iOS the compact picker. */
export function DateTimeField({ label, value, onChange, error }: Props) {
  const openAndroid = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: false,
      minimumDate: mode === 'date' ? new Date() : undefined,
      onChange: (event: DateTimePickerEvent, picked?: Date) => {
        if (event.type !== 'set' || !picked) return;
        const next = new Date(value);
        if (mode === 'date')
          next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
        else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
        onChange(next);
      },
    });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      {Platform.OS === 'android' ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Date, ${formatDay(value.toISOString())}. Change date`}
            style={[styles.box, !!error && styles.boxError]}
            onPress={() => openAndroid('date')}
            testID="date-button"
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.value}>{formatDay(value.toISOString())}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start time, ${formatTime(value.toISOString())}. Change time`}
            style={[styles.box, !!error && styles.boxError]}
            onPress={() => openAndroid('time')}
            testID="time-button"
          >
            <Ionicons name="time-outline" size={18} color={colors.primary} />
            <Text style={styles.value}>{formatTime(value.toISOString())}</Text>
          </Pressable>
        </View>
      ) : (
        <DateTimePicker
          value={value}
          mode="datetime"
          display="compact"
          minimumDate={new Date()}
          onChange={(_e, picked) => picked && onChange(picked)}
        />
      )}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  row: { flexDirection: 'row', gap: spacing.sm },
  box: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  boxError: { borderColor: colors.danger },
  value: { ...typography.body, color: colors.text },
  error: { ...typography.caption, color: colors.danger },
});
