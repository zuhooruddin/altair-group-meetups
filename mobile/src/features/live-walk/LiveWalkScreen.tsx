import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { messageFor } from '../../core/api/api-error';
import type { LiveWalkStatus } from '../../core/ports';
import type { ScreenProps } from '../../navigation/types';
import { ErrorState, LoadingState } from '../../ui/StateViews';
import { colors, radius, spacing, typography } from '../../ui/theme';
import { useMeetupDetail } from '../meetups/hooks';
import type { Region } from './engine';
import { ParticipantMarker } from './ParticipantMarker';
import { useLiveWalk } from './use-live-walk';

const statusLabel: Record<LiveWalkStatus, string> = {
  joining: 'Connecting…',
  live: 'Live',
  denied: 'Not allowed: RSVP to join the live walk',
  error: 'Connection problem, retrying when you come back',
  closed: 'Disconnected',
};

function useAppActive() {
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/** Bonus work sample. Positions are synthetic (see REALTIME_MAP_BONUS.md). */
export function LiveWalkScreen({ route }: ScreenProps<'LiveWalk'>) {
  const { meetupId } = route.params;
  const detail = useMeetupDetail(meetupId);
  // Both hooks run on every render (no short-circuit: rules of hooks).
  const focused = useIsFocused();
  const appActive = useAppActive();
  const active = focused && appActive;

  if (detail.isPending) return <LoadingState message="Loading meetup…" />;
  if (detail.isError) return <ErrorState message={messageFor(detail.error)} />;
  const point = detail.data.meetingPoint;
  if (point.visibility !== 'exact') {
    return <ErrorState message="Only the host and members who RSVP’d can join the live walk." />;
  }
  return <LiveMap meetupId={meetupId} center={point} active={active} />;
}

function LiveMap({
  meetupId,
  center,
  active,
}: {
  meetupId: string;
  center: { latitude: number; longitude: number; placeName: string };
  active: boolean;
}) {
  const initialRegion: Region = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.012,
    longitudeDelta: 0.012,
  };
  // Read by the frame loop; updating it never re-renders.
  const regionRef = useRef<Region>(initialRegion);
  const { status, frame, counters } = useLiveWalk(meetupId, regionRef, active);

  return (
    <View style={styles.screen}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChangeComplete={(r) => {
          regionRef.current = r;
        }}
        showsUserLocation={false}
        toolbarEnabled={false}
        testID="live-map"
      >
        <Marker coordinate={center} title={center.placeName} pinColor={colors.primary} />
        {frame.visible.map((p) => (
          <ParticipantMarker
            key={p.participantId}
            participantId={p.participantId}
            latitude={p.latitude}
            longitude={p.longitude}
          />
        ))}
      </MapView>
      <View style={styles.panel} pointerEvents="none">
        <View style={styles.row}>
          <View style={[styles.dot, status === 'live' ? styles.dotLive : styles.dotIdle]} />
          <Text style={styles.status} testID="live-status">
            {statusLabel[status]}
          </Text>
        </View>
        <Text style={styles.stats} testID="live-stats">
          {frame.total} walkers · {frame.visible.length} on screen · dropped {counters.stale} late,{' '}
          {counters.outOfOrder + counters.duplicate} out of order, {counters.invalid} invalid
        </Text>
        <Text style={styles.note}>Demo: simulated walkers, not real people.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.secondary },
  panel: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotLive: { backgroundColor: colors.success },
  dotIdle: { backgroundColor: colors.warning },
  status: { ...typography.heading, color: colors.text },
  stats: { ...typography.caption, color: colors.textMuted },
  note: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
});
