import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { readAppConfig } from './config/env';
import { ApiClient } from './core/api/api-client';
import { createGroupsGateway, createMeetupsGateway } from './core/api/gateways';
import { createSupabaseAuthGateway } from './core/auth/supabase-auth-gateway';
import type { AppServices } from './core/ports';
import { ServicesProvider } from './core/services';
import { AuthProvider } from './features/auth/AuthProvider';
import { RootNavigator } from './navigation/RootNavigator';
import { ErrorState } from './ui/StateViews';

/** Composition root: the only place that knows about Supabase, fetch and the API URL. */
function createServices(): AppServices | { problems: string[] } {
  const result = readAppConfig();
  if (!result.ok) return { problems: result.problems };
  const auth = createSupabaseAuthGateway(result.config.supabaseUrl, result.config.supabaseAnonKey);
  const api = new ApiClient(result.config.apiUrl, () => auth.accessToken());
  return { auth, groups: createGroupsGateway(api), meetups: createMeetupsGateway(api) };
}

export function AppRoot({ services }: { services: AppServices }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15_000 }, mutations: { retry: 0 } } }),
  );
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ServicesProvider services={services}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export default function App() {
  const [services] = useState(createServices);
  if ('problems' in services) {
    return <ErrorState message={`App is not configured (see mobile/.env.example): ${services.problems.join('; ')}`} />;
  }
  return <AppRoot services={services} />;
}
