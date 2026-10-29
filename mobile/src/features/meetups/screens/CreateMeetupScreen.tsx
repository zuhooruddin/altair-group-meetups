import { createMeetupRequestSchema, MEETUP_TITLE_MAX, PLACE_NAME_MAX, type CreateMeetupInput } from '@altair/shared';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiError, messageFor } from '../../../core/api/api-error';
import type { ScreenProps } from '../../../navigation/types';
import { Banner } from '../../../ui/Banner';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/TextField';
import { colors, radius, spacing, typography } from '../../../ui/theme';
import { GroupPicker } from '../../groups/GroupPicker';
import { useMyGroups } from '../../groups/hooks';
import { DateTimeField } from '../components/DateTimeField';
import { LocationPicker } from '../components/LocationPicker';
import { useCreateMeetup } from '../hooks';

/** The seed's spare public place, offered as a one-tap fill. */
const SPARE_PLACE = { placeName: 'Fountain plaza, Town Green', latitude: 39.999134, longitude: -99.999461 };

type FieldKey = 'groupId' | 'title' | 'startsAt' | 'placeName' | 'latitude' | 'longitude';
type FieldErrors = Partial<Record<FieldKey, string>>;

function tomorrowAtNine(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

const toNumber = (text: string) => (text.trim() === '' ? undefined : Number(text.trim()));

/** Maps contract issue paths (from the shared schema or the server) onto form fields. */
function toFieldErrors(issues: { path: string; message: string }[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.split('.').pop() as FieldKey | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function CreateMeetupScreen({ route, navigation }: ScreenProps<'CreateMeetup'>) {
  const groups = useMyGroups();
  const create = useCreateMeetup();
  const [groupId, setGroupId] = useState(route.params.groupId);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState(tomorrowAtNine);
  const [placeName, setPlaceName] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const lat = toNumber(latText);
  const lng = toNumber(lngText);

  const setPoint = (latitude: number, longitude: number) => {
    setLatText(String(latitude));
    setLngText(String(longitude));
  };

  const submit = () => {
    setServerError(null);
    const input: CreateMeetupInput = {
      groupId,
      title,
      startsAt: startsAt.toISOString(),
      meetingPoint: { placeName, latitude: lat as number, longitude: lng as number },
    };
    // Same schema the server validates with; the server re-checks everything.
    const parsed = createMeetupRequestSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
      return;
    }
    setErrors({});
    create.mutate(parsed.data, {
      onSuccess: (meetup) => navigation.replace('MeetupDetail', { meetupId: meetup.id, flash: 'created' }),
      onError: (error) => {
        if (error instanceof ApiError && error.issues.length > 0) setErrors(toFieldErrors(error.issues));
        setServerError(messageFor(error));
      },
    });
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" testID="create-meetup">
        {groups.data && groups.data.length > 1 ? (
          <View style={styles.field}>
            <Text style={styles.label}>Group</Text>
            <View style={styles.pickerBleed}>
              <GroupPicker groups={groups.data} selectedId={groupId} onSelect={setGroupId} />
            </View>
            {errors.groupId ? <Text style={styles.error}>{errors.groupId}</Text> : null}
          </View>
        ) : null}

        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Saturday morning loop"
          maxLength={MEETUP_TITLE_MAX + 20}
          error={errors.title}
          hint={`${title.trim().length}/${MEETUP_TITLE_MAX}`}
          testID="title-input"
        />

        <DateTimeField label="Date and start time" value={startsAt} onChange={setStartsAt} error={errors.startsAt} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meeting point</Text>
          <Text style={styles.sectionHint}>
            Choose a public place. Members who haven’t RSVP’d only see an approximate area until they do.
          </Text>
          <Pressable
            style={styles.quickFill}
            accessibilityRole="button"
            onPress={() => {
              setPlaceName(SPARE_PLACE.placeName);
              setPoint(SPARE_PLACE.latitude, SPARE_PLACE.longitude);
            }}
            testID="use-spare-place"
          >
            <Text style={styles.quickFillText}>Use “{SPARE_PLACE.placeName}”</Text>
          </Pressable>
          <TextField
            label="Place name"
            value={placeName}
            onChangeText={setPlaceName}
            placeholder="North gate, Linden Park"
            maxLength={PLACE_NAME_MAX + 20}
            error={errors.placeName}
            testID="place-input"
          />
          <LocationPicker
            latitude={lat !== undefined && Number.isFinite(lat) ? lat : null}
            longitude={lng !== undefined && Number.isFinite(lng) ? lng : null}
            onPick={setPoint}
          />
          <View style={styles.coords}>
            <View style={styles.coord}>
              <TextField label="Latitude" value={latText} onChangeText={setLatText} keyboardType="numbers-and-punctuation" placeholder="39.999134" error={errors.latitude} testID="lat-input" />
            </View>
            <View style={styles.coord}>
              <TextField label="Longitude" value={lngText} onChangeText={setLngText} keyboardType="numbers-and-punctuation" placeholder="-99.999461" error={errors.longitude} testID="lng-input" />
            </View>
          </View>
        </View>

        {serverError ? <Banner tone="error" message={serverError} testID="create-error" /> : null}
        <Button label="Create meetup" onPress={submit} loading={create.isPending} testID="create-submit" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
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
