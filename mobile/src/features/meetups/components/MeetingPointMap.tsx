import type { MeetingPointView } from '@altair/shared';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';
import { colors, radius, spacing, typography } from '../../../ui/theme';

const METERS_PER_DEGREE = 111_320;

/** Frames the exact point closely, or the whole approximate circle with some margin. */
export function regionFor(point: MeetingPointView): Region {
  if (point.visibility === 'exact') {
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      latitudeDelta: 0.006,
      longitudeDelta: 0.006,
    };
  }
  const delta = (point.radiusMeters * 2 * 1.5) / METERS_PER_DEGREE;
  return {
    latitude: point.centerLatitude,
    longitude: point.centerLongitude,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

interface Props {
  point: MeetingPointView;
  height?: number;
}

/**
 * Renders only what the server sent. For a member who has not RSVP'd that is
 * an offset area (no exact coordinates and no place name exist on the device).
 */
export function MeetingPointMap({ point, height = 220 }: Props) {
  const region = regionFor(point);
  const isExact = point.visibility === 'exact';
  // Remount when the view changes (e.g. right after an RSVP) so the camera reframes.
  const key = isExact
    ? `exact:${point.latitude}:${point.longitude}`
    : `area:${point.centerLatitude}:${point.centerLongitude}:${point.radiusMeters}`;

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView
        key={key}
        testID={isExact ? 'map-exact' : 'map-approximate'}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsPointsOfInterests={false}
        customMapStyle={[
          { elementType: 'geometry', stylers: [{ color: '#ECEEE5' }] },
          {
            featureType: 'landscape.natural',
            elementType: 'geometry',
            stylers: [{ color: '#DCEDE1' }],
          },
          { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#C6EAD8' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#B9DEDC' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#75857C' }] },
        ]}
        accessibilityLabel={
          isExact
            ? `Map showing the exact meeting point: ${point.placeName}`
            : 'Map showing the approximate meeting area'
        }
      >
        {isExact ? (
          <Marker
            testID="map-marker"
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            title={point.placeName}
            pinColor={colors.primary}
          />
        ) : (
          <Circle
            testID="map-area"
            center={{ latitude: point.centerLatitude, longitude: point.centerLongitude }}
            radius={point.radiusMeters}
            strokeColor={colors.accent}
            strokeWidth={2}
            fillColor={colors.accentSoft}
          />
        )}
      </MapView>
      <View style={styles.legend} pointerEvents="none">
        <Ionicons
          name={isExact ? 'location' : 'scan-circle-outline'}
          size={14}
          color={isExact ? colors.primary : colors.accent}
        />
        <Text style={styles.legendText}>
          {isExact ? 'Exact meeting point' : `Approximate area · ~${point.radiusMeters} m`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.secondary },
  legend: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  legendText: { ...typography.caption, color: colors.text, fontWeight: '600' },
});
