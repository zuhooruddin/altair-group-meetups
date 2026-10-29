import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Banner } from '../../ui/Banner';
import { Avatar } from '../../ui/Avatar';
import { artwork } from '../../ui/artwork';
import { Button } from '../../ui/Button';
import { TextField } from '../../ui/TextField';
import { colors, radius, spacing, typography } from '../../ui/theme';
import { useAuth } from './AuthProvider';

const credentialsSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

/** Dev-only shortcuts for the seeded accounts (emails only; the password is still typed). */
const SEED_EMAILS = ['avery', 'jordan', 'sam', 'riley', 'taylor'].map((n) => `${n}@example.test`);

export function SignInScreen() {
  const { height } = useWindowDimensions();
  const compact = height < 650;
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    const parsed = credentialsSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error).fieldErrors;
      setFieldErrors({ email: flat.email?.[0], password: flat.password?.[0] });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await signIn(parsed.data.email, parsed.data.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <ImageBackground
            source={artwork.welcome}
            style={[
              styles.hero,
              { height: compact ? 88 : Math.min(400, Math.max(300, height * 0.43)) },
            ]}
            imageStyle={styles.heroImage}
          >
            <View style={styles.heroTint} />
            <View style={[styles.brand, compact && styles.brandCompact]}>
              <View style={[styles.logo, compact && styles.logoCompact]}>
                <Ionicons name="people" size={compact ? 24 : 30} color={colors.onPrimary} />
              </View>
              <View style={[styles.brandCopy, compact && styles.brandCopyCompact]}>
                <Text style={[styles.appName, compact && styles.appNameCompact]}>Altair</Text>
                {/* A solid panel keeps the tagline readable over any part of the photo. */}
                <View style={[styles.taglinePanel, compact && styles.taglinePanelCompact]}>
                  <Text style={[styles.tagline, compact && styles.taglineCompact]}>
                    Discover walks.{'\n'}Connect with neighbors.
                  </Text>
                </View>
              </View>
            </View>
          </ImageBackground>

          <View style={[styles.sheet, compact && styles.sheetCompact]}>
            <View style={[styles.sheetHeading, compact && styles.sheetHeadingCompact]}>
              <View>
                <Text style={styles.sheetTitle}>Welcome back</Text>
                <Text style={styles.sheetSubtitle}>Sign in to continue to your account</Text>
              </View>
              <Ionicons name="leaf-outline" size={20} color={colors.primary} />
            </View>
            <View style={[styles.form, compact && styles.formCompact]}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.test"
                error={fieldErrors.email}
                testID="email-input"
                returnKeyType="next"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
                textContentType="password"
                placeholder="Your password"
                error={fieldErrors.password}
                testID="password-input"
                returnKeyType="go"
                onSubmitEditing={submit}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </Pressable>
                }
              />
              {error ? <Banner tone="error" message={error} testID="sign-in-error" /> : null}
              <Button
                label="Sign in"
                onPress={submit}
                loading={submitting}
                testID="sign-in-button"
              />
            </View>

            {__DEV__ ? (
              <View style={styles.dev}>
                <Text style={styles.devTitle}>Try a demo account</Text>
                <Text style={styles.devHint}>Choose a test account, then enter its password.</Text>
                <View style={styles.devRow}>
                  {SEED_EMAILS.map((seed) => (
                    <Pressable
                      key={seed}
                      style={styles.devChip}
                      onPress={() => setEmail(seed)}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${seed}`}
                    >
                      <Avatar demoEmail={seed} name={seed.split('@')[0]!} size={42} />
                      <Text style={styles.devChipText}>
                        {seed[0]!.toUpperCase() + seed.split('@')[0]!.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.bottomNote}>
              <Ionicons name="people-outline" size={19} color={colors.primary} />
              <Text style={styles.bottomText}>A friendlier neighborhood, one walk at a time.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: spacing.lg },
  hero: { justifyContent: 'flex-start' },
  heroImage: { resizeMode: 'cover' },
  heroTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(250,248,241,0.46)',
  },
  brand: { alignItems: 'center', padding: spacing.lg, paddingBottom: spacing.xl, gap: 2 },
  brandCompact: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  brandCopy: { alignItems: 'center' },
  brandCopyCompact: { alignItems: 'flex-start' },
  logoCompact: { width: 42, height: 42, borderRadius: 13, marginBottom: 0 },
  appNameCompact: { fontSize: 26, letterSpacing: -0.5 },
  taglineCompact: { fontSize: 12, lineHeight: 15, marginTop: 0, textAlign: 'left' },
  sheetCompact: { marginTop: -12, padding: spacing.lg, gap: spacing.md },
  sheetHeadingCompact: { paddingBottom: spacing.sm },
  formCompact: { gap: spacing.md },
  sheet: {
    marginTop: -30,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.background,
    padding: spacing.xl,
    gap: spacing.xl,
  },
  sheetHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  sheetTitle: { ...typography.title, color: colors.text },
  sheetSubtitle: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '500',
    color: '#53625A',
    marginTop: spacing.xs,
  },
  bottomNote: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomText: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  logo: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  appName: { ...typography.display, fontSize: 44, letterSpacing: -1.5, color: colors.primary },
  taglinePanel: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(250,248,241,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,91,67,0.14)',
  },
  taglinePanelCompact: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#003C2B',
    textAlign: 'center',
    lineHeight: 23,
  },
  form: { gap: spacing.lg },
  dev: {
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.secondary,
    padding: spacing.lg,
    borderRadius: radius.md,
  },
  devTitle: { ...typography.label, color: colors.primary },
  devHint: { ...typography.caption, fontSize: 13, color: '#53625A', textAlign: 'center' },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  devChip: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 44,
    minHeight: 64,
    paddingVertical: spacing.xs,
  },
  devChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
