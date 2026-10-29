import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Banner } from '../../ui/Banner';
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Ionicons name="paw" size={30} color={colors.onPrimary} />
            </View>
            <Text style={styles.appName}>Altair</Text>
            <Text style={styles.tagline}>Neighborhood dog walks, together.</Text>
          </View>

          <View style={styles.form}>
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
            <Button label="Sign in" onPress={submit} loading={submitting} testID="sign-in-button" />
          </View>

          {__DEV__ ? (
            <View style={styles.dev}>
              <Text style={styles.devTitle}>Seeded test accounts</Text>
              <View style={styles.devRow}>
                {SEED_EMAILS.map((seed) => (
                  <Pressable
                    key={seed}
                    style={styles.devChip}
                    onPress={() => setEmail(seed)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.devChipText}>{seed.split('@')[0]}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xxl },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  appName: { ...typography.display, color: colors.primary },
  tagline: { ...typography.body, color: colors.textMuted },
  form: { gap: spacing.lg },
  dev: { gap: spacing.sm, alignItems: 'center' },
  devTitle: { ...typography.caption, color: colors.textMuted },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  devChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  devChipText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
