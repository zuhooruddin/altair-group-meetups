import { LIVE_POSITION_EVENT, liveWalkTopic } from '@altair/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createClient,
  type RealtimeChannel,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { AuthGateway, AuthSession, LiveWalkGateway } from '../ports';

const toSession = (session: Session | null): AuthSession | null =>
  session ? { userId: session.user.id, email: session.user.email ?? null } : null;

/**
 * The app's only Supabase client. Sign-in goes straight to Supabase Auth
 * (spec section 10); the bonus live walk uses Realtime. Data reads and
 * writes go through the API, never through this client.
 */
export function createSupabaseGateways(
  url: string,
  anonKey: string,
): { auth: AuthGateway; liveWalk: LiveWalkGateway } {
  const client: SupabaseClient = createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  // Refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });

  const auth: AuthGateway = {
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
      await client.removeAllChannels();
      await client.auth.signOut();
    },
    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) =>
        listener(toSession(session)),
      );
      return () => data.subscription.unsubscribe();
    },
    async accessToken() {
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
  };

  const liveWalk: LiveWalkGateway = {
    join(meetupId, { onPosition, onStatus }) {
      let channel: RealtimeChannel | null = null;
      let left = false;
      onStatus('joining');

      void (async () => {
        const { data } = await client.auth.getSession();
        if (!data.session) return onStatus('denied');
        // Private channel: Realtime checks RLS on realtime.messages with this token.
        await client.realtime.setAuth(data.session.access_token);
        if (left) return;
        channel = client
          .channel(liveWalkTopic(meetupId), { config: { private: true } })
          .on('broadcast', { event: LIVE_POSITION_EVENT }, (message) =>
            onPosition(message.payload, Date.now()),
          )
          .subscribe((status, error) => {
            if (status === 'SUBSCRIBED') onStatus('live');
            else if (status === 'CHANNEL_ERROR')
              onStatus(/unauthori[sz]ed|denied/i.test(error?.message ?? '') ? 'denied' : 'error');
            else if (status === 'TIMED_OUT') onStatus('error');
            else if (status === 'CLOSED') onStatus('closed');
          });
      })();

      return () => {
        left = true;
        if (channel) void client.removeChannel(channel);
      };
    },
  };

  return { auth, liveWalk };
}
