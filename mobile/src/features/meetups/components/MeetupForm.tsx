import { MEETUP_TITLE_MAX, PLACE_NAME_MAX, type Group } from '@altair/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextField } from '../../../ui/TextField';
import { colors, radius, spacing, typography } from '../../../ui/theme';
import { GroupPicker } from '../../groups/GroupPicker';
import { DateTimeField } from './DateTimeField';
import { LocationPicker } from './LocationPicker';

/** The seed's spare public place, offered as a one-tap fill. */
export const SPARE_PLACE = {
  placeName: 'Fountain plaza, Town Green',
  latitude: 39.999134,
  longitude: -99.999461,
};

type FieldKey = 'groupId' | 'title' | 'startsAt' | 'placeName' | 'latitude' | 'longitude';
export type FieldErrors = Partial<Record<FieldKey, string>>;

export interface MeetupFormInitial {
  groupId?: string;
  title?: string;
  startsAt: Date;
  placeName?: string;
  latitude?: number;
  longitude?: number;
}

const toNumber = (text: string) => (text.trim() === '' ? undefined : Number(text.trim()));

/**
 * Form state shared by Create and Edit. Screens decide which shared schema
 * validates the draft and which mutation sends it.
 */
export function useMeetupForm(initial: MeetupFormInitial) {
  const [groupId, setGroupId] = useState(initial.groupId);
  const [title, setTitle] = useState(initial.title ?? '');
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [placeName, setPlaceName] = useState(initial.placeName ?? '');
  const [latText, setLatText] = useState(initial.latitude?.toString() ?? '');
  const [lngText, setLngText] = useState(initial.longitude?.toString() ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const setPoint = (latitude: number, longitude: number) => {
    setLatText(String(latitude));
    setLngText(String(longitude));
  };

  return {
    values: { groupId, title, startsAt, placeName, latText, lngText },
    set: { setGroupId, setTitle, setStartsAt, setPlaceName, setLatText, setLngText, setPoint },
    errors,
    serverError,
    setServerError,
    /** Contract-shaped draft (coordinates as numbers; empty -> undefined so the schema reports it). */
    draft() {
      return {
        groupId,
        title,
        startsAt: startsAt.toISOString(),
        meetingPoint: {
          placeName,
          latitude: toNumber(latText) as number,
          longitude: toNumber(lngText) as number,
        },
      };
    },
    /** Maps issue paths (shared schema or server) onto fields, e.g. meetingPoint.latitude -> latitude. */
    showIssues(issues: { path: string; message: string }[]) {
      const next: FieldErrors = {};
      for (const issue of issues) {
        const key = issue.path.split('.').pop() as FieldKey | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
    },
    clearErrors() {
      setErrors({});
      setServerError(null);
    },
  };
}

export type MeetupFormState = ReturnType<typeof useMeetupForm>;

export function MeetupFormFields({ form, groups }: { form: MeetupFormState; groups?: Group[] }) {
  const { values, set, errors } = form;
  const lat = toNumber(values.latText);
  const lng = toNumber(values.lngText);

  return (
    <>
      {groups && groups.length > 1 ? (
        <View style={styles.field}>
          <Text style={styles.label}>Group</Text>
          <View style={styles.pickerBleed}>
            <GroupPicker groups={groups} selectedId={values.groupId} onSelect={set.setGroupId} />
          </View>
          {errors.groupId ? <Text style={styles.error}>{errors.groupId}</Text> : null}
        </View>
      ) : null}

      <TextField
        label="Title"
        value={values.title}
        onChangeText={set.setTitle}
        placeholder="Saturday morning loop"
        maxLength={MEETUP_TITLE_MAX + 20}
        error={errors.title}
        hint={`${values.title.trim().length}/${MEETUP_TITLE_MAX}`}
        testID="title-input"
      />

      <DateTimeField
        label="Date and start time"
        value={values.startsAt}
        onChange={set.setStartsAt}
        error={errors.startsAt}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Meeting point</Text>
        <Text style={styles.sectionHint}>
          Choose a public place. Members who haven’t RSVP’d only see an approximate area until they
          do.
        </Text>
        <Pressable
          style={styles.quickFill}
          accessibilityRole="button"
          onPress={() => {
            set.setPlaceName(SPARE_PLACE.placeName);
            set.setPoint(SPARE_PLACE.latitude, SPARE_PLACE.longitude);
          }}
          testID="use-spare-place"
        >
          <Text style={styles.quickFillText}>Use “{SPARE_PLACE.placeName}”</Text>
        </Pressable>
        <TextField
          label="Place name"
          value={values.placeName}
          onChangeText={set.setPlaceName}
          placeholder="North gate, Linden Park"
          maxLength={PLACE_NAME_MAX + 20}
          error={errors.placeName}
          testID="place-input"
        />
        <LocationPicker
          latitude={lat !== undefined && Number.isFinite(lat) ? lat : null}
          longitude={lng !== undefined && Number.isFinite(lng) ? lng : null}
          onPick={set.setPoint}
        />
        <View style={styles.coords}>
          <View style={styles.coord}>
            <TextField
              label="Latitude"
              value={values.latText}
              onChangeText={set.setLatText}
              keyboardType="numbers-and-punctuation"
              placeholder="39.999134"
              error={errors.latitude}
              testID="lat-input"
            />
          </View>
          <View style={styles.coord}>
            <TextField
              label="Longitude"
              value={values.lngText}
              onChangeText={set.setLngText}
              keyboardType="numbers-and-punctuation"
              placeholder="-99.999461"
              error={errors.longitude}
              testID="lng-input"
            />
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: { ...typography.label, color: colors.text },
  pickerBleed: { marginHorizontal: -spacing.lg },
  error: { ...typography.caption, color: colors.danger },
  section: { gap: spacing.md },
  sectionTitle: { ...typography.heading, color: colors.text },
  sectionHint: { ...typography.caption, color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  quickFill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  quickFillText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  coords: { flexDirection: 'row', gap: spacing.md },
  coord: { flex: 1 },
});
