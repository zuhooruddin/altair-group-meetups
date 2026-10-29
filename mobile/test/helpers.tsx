import type { MeetupDetail, MeetupSummary } from '@altair/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { AppServices, AuthGateway } from '../src/core/ports';
import { ServicesProvider } from '../src/core/services';
import { AuthProvider } from '../src/features/auth/AuthProvider';

export const SAM = 'a1000000-0000-4000-8000-000000000003';
export const AVERY = 'a1000000-0000-4000-8000-000000000001';
export const MAPLE = 'b2000000-0000-4000-8000-000000000001';
export const SATURDAY = 'c3000000-0000-4000-8000-000000000001';

export function fakeAuth(userId = SAM): AuthGateway {
  const session = { userId, email: 'sam@example.test' };
  return {
    currentSession: async () => session,
    signIn: async () => session,
    signOut: async () => undefined,
    onSessionChange: () => () => undefined,
    accessToken: async () => 'token',
  };
}

export function fakeServices(
  overrides: Partial<{ [K in keyof AppServices]: Partial<AppServices[K]> }> = {},
  userId = SAM,
): AppServices {
  const reject = () => Promise.reject(new Error('not stubbed'));
  return {
    auth: { ...fakeAuth(userId), ...overrides.auth },
    groups: { listMine: reject, ...overrides.groups },
    liveWalk: { join: () => () => undefined, ...overrides.liveWalk },
    meetups: {
      listForGroup: reject,
      get: reject,
      create: reject,
      cancel: reject,
      update: reject,
      rsvp: reject,
      withdraw: reject,
      ...overrides.meetups,
    },
  };
}

/** Testing Library 14 renders asynchronously (React 19): always await this. */
export async function renderWithServices(ui: ReactElement, services: AppServices) {
  // gcTime: Infinity keeps React Query from scheduling cache-GC timers that outlive the test.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ServicesProvider services={services}>
          <AuthProvider>{ui}</AuthProvider>
        </ServicesProvider>
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

export function fakeNavigation() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    setOptions: jest.fn(),
    goBack: jest.fn(),
  } as never;
}

const approximate = {
  visibility: 'approximate' as const,
  label: 'Approximate area · RSVP to see the exact meeting point',
  centerLatitude: 40.0139,
  centerLongitude: -99.9861,
  radiusMeters: 400,
};

const exact = {
  visibility: 'exact' as const,
  placeName: 'North gate, Linden Park',
  latitude: 40.012046,
  longitude: -99.984517,
};

export function summary(overrides: Partial<MeetupSummary> = {}): MeetupSummary {
  return {
    id: SATURDAY,
    groupId: MAPLE,
    title: 'Saturday morning loop',
    startsAt: '2099-11-07T15:00:00.000Z',
    status: 'scheduled',
    cancelledAt: null,
    creator: { id: AVERY, displayName: 'Avery Lin' },
    attendeeCount: 2,
    viewer: {
      isCreator: false,
      isAttending: false,
      canRsvp: true,
      canCancel: false,
      canEdit: false,
    },
    meetingPoint: approximate,
    ...overrides,
  };
}

export function detail(overrides: Partial<MeetupDetail> = {}): MeetupDetail {
  return {
    ...summary(),
    attendees: [
      {
        userId: 'a1000000-0000-4000-8000-000000000002',
        displayName: 'Jordan Price',
        rsvpAt: '2026-10-29T10:00:00.000Z',
      },
      {
        userId: 'a1000000-0000-4000-8000-000000000004',
        displayName: 'Riley Chen',
        rsvpAt: '2026-10-29T10:01:00.000Z',
      },
    ],
    ...overrides,
  };
}

export const points = { approximate, exact };
