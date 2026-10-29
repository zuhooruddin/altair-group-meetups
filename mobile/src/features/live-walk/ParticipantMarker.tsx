import { memo, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '../../ui/theme';

const labelFor = (participantId: string) => {
  const digits = participantId.match(/\d+/)?.[0];
  return digits ? `W${Number(digits)}` : participantId.slice(0, 2).toUpperCase();
};

interface Props {
  participantId: string;
  latitude: number;
  longitude: number;
}

/**
 * A synthetic walker's avatar. The custom view is captured once and then
 * frozen (`tracksViewChanges` off), so moving the marker only updates its
 * native coordinate instead of re-rasterising the view every frame.
 */
function ParticipantMarkerView({ participantId, latitude, longitude }: Props) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setTracksViewChanges(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Marker
      testID="walker-marker"
      identifier={participantId}
      coordinate={{ latitude, longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View style={styles.avatar}>
        <Text style={styles.label}>{labelFor(participantId)}</Text>
      </View>
    </Marker>
  );
}

export const ParticipantMarker = memo(ParticipantMarkerView);

const styles = StyleSheet.create({
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.onPrimary, fontSize: 11, fontWeight: '700' },
});
