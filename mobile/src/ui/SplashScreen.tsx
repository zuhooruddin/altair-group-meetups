import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from './theme';
import { artwork } from './artwork';

/** Full-screen artwork during the existing authentication loading state. */
export function SplashScreen() {
  const { height } = useWindowDimensions();
  return (
    <View style={styles.screen}>
      <Image source={artwork.welcome} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <View style={styles.skyTint} />
      <View style={styles.footerTint} />
      <SafeAreaView style={styles.safe}>
        <View style={[styles.brand, { paddingTop: Math.max(32, Math.min(120, height * 0.12)) }]}>
          <View style={styles.mark}>
            <Ionicons name="people" size={40} color={colors.onPrimary} />
          </View>
          <Text style={styles.title}>Altair</Text>
          <Text style={styles.tagline}>Discover walks.{'\n'}Connect with neighbors.</Text>
        </View>
        <View
          style={styles.footer}
          accessibilityRole="progressbar"
          accessibilityLabel="Starting…"
          testID="state-loading"
        >
          <ActivityIndicator color={colors.onPrimary} />
          <Text style={styles.note}>A safer, friendlier{'\n'}neighborhood together.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, justifyContent: 'space-between' },
  skyTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(250,248,241,0.24)',
  },
  footerTint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,35,26,0.32)',
  },
  brand: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl },
  mark: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 54, fontWeight: '700', letterSpacing: -2, color: '#16452F' },
  tagline: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 25,
    color: '#003C2B',
    textAlign: 'center',
    textShadowColor: '#FAF8F1',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  footer: { padding: spacing.xl, gap: spacing.lg, alignItems: 'center' },
  note: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    color: colors.onPrimary,
    textAlign: 'center',
    textShadowColor: '#163A2B',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
