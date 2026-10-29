import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { AuthGateway, AuthSession } from '../ports';

const toSession = (session: Session | null): AuthSession | null =>
  session ? { userId: session.user.id, email: session.user.email ?? null } : null;

/**
 * Sign-in goes straight to Supabase Auth (spec section 10). This client is
 * used for auth only: data reads and writes go through the API.
 */
export function createSupabaseAuthGateway(url: string, anonKey: string): AuthGateway {
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  // Refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });

  return {
    async currentSession() {
      const { data } = await client.auth.getSession();
      return toSession(data.session);
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        throw new Error(
          error?.message === 'Invalid login credentials'
            ? 'That email and password don’t match an account.'
            : 'Sign-in failed. Check your connection and try again.',
        );
      }
      return toSession(data.session)!;
    },
    async signOut() {
      await client.auth.signOut();
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async accessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
  };
}
