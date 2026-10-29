import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { colors, radius, spacing, typography } from '../../../ui/theme';

/** Center of the fictional seed town (README: arbitrary reference point 40 N, 100 W). */
const TOWN_CENTER = { latitude: 40.0, longitude: -100.0 };

interface Props {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Tap the map (or drag the pin) to choose the meeting point. Never uses the member's own location. */
export function LocationPicker({ latitude, longitude, onPick }: Props) {
  const hasPoint = latitude !== null && longitude !== null;
  const pick = (e: MapPressEvent) => onPick(round6(e.nativeEvent.coordinate.latitude), round6(e.nativeEvent.coordinate.longitude));

  return (
    <View style={styles.wrapper}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: hasPoint ? latitude : TOWN_CENTER.latitude,
          longitude: hasPoint ? longitude : TOWN_CENTER.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onPress={pick}
        showsUserLocation={false}
        toolbarEnabled={false}
        testID="location-picker"
        accessibilityLabel="Map. Tap to choose the meeting point."
      >
        {hasPoint ? (
          <Marker
            coordinate={{ latitude, longitude }}
            draggable
            onDragEnd={(e) => onPick(round6(e.nativeEvent.coordinate.latitude), round6(e.nativeEvent.coordinate.longitude))}
            pinColor={colors.primary}
          />
        ) : null}
      </MapView>
      <View style={styles.hint} pointerEvents="none">
        <Text style={styles.hintText}>{hasPoint ? 'Drag the pin or tap to move it' : 'Tap the map to drop a pin'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 200, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.secondary },
  hint: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hintText: { ...typography.caption, color: colors.text, fontWeight: '600' },
});
