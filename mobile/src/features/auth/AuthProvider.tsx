import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthSession } from '../../core/ports';
import { useServices } from '../../core/services';

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; session: AuthSession };

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    auth
      .currentSession()
      .then((session) => active && setState(session ? { status: 'signedIn', session } : { status: 'signedOut' }))
      .catch(() => active && setState({ status: 'signedOut' }));
    const unsubscribe = auth.onSessionChange((session) => {
      if (!session) queryClient.clear(); // never show one member's cached data to the next
      setState(session ? { status: 'signedIn', session } : { status: 'signedOut' });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth, queryClient]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      queryClient.clear();
      const session = await auth.signIn(email, password);
      setState({ status: 'signedIn', session });
    },
    [auth, queryClient],
  );

  const signOut = useCallback(async () => {
    await auth.signOut();
    queryClient.clear();
    setState({ status: 'signedOut' });
  }, [auth, queryClient]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

export function useCurrentUserId(): string | null {
  const { state } = useAuth();
  return state.status === 'signedIn' ? state.session.userId : null;
}
