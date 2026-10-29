import { renderHook, waitFor } from '@testing-library/react-native';
import { act, type ReactNode } from 'react';
import type { LiveWalkGateway, LiveWalkStatus } from '../src/core/ports';
import { ServicesProvider } from '../src/core/services';
import type { Region } from '../src/features/live-walk/engine';
import { useLiveWalk } from '../src/features/live-walk/use-live-walk';
import { SATURDAY, fakeServices } from './helpers';

type Handlers = Parameters<LiveWalkGateway['join']>[1];

function fakeLiveWalk() {
  const state: { handlers: Handlers | null; joins: number; leaves: number } = {
    handlers: null,
    joins: 0,
    leaves: 0,
  };
  const gateway: LiveWalkGateway = {
    join: (_id, handlers) => {
      state.joins += 1;
      state.handlers = handlers;
      return () => {
        state.leaves += 1;
      };
    },
  };
  return { gateway, state };
}

const region: Region = { latitude: 40, longitude: -100, latitudeDelta: 0.01, longitudeDelta: 0.01 };
const options = { renderDelayMs: 0, staleAfterMs: 5000, dropAfterMs: 60000, bufferSize: 4 };

async function setup(active = true) {
  const live = fakeLiveWalk();
  const services = fakeServices({ liveWalk: live.gateway });
  const regionRef = { current: region };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={services}>{children}</ServicesProvider>
  );
  const hook = await renderHook(
    (props: { active: boolean }) => useLiveWalk(SATURDAY, regionRef, props.active, 20, options),
    { wrapper, initialProps: { active } },
  );
  return { ...live, hook };
}

const position = (id: string, latitude: number, seq = 1) => ({
  participantId: id,
  latitude,
  longitude: -100,
  ts: Date.now(),
  seq,
});

describe('useLiveWalk', () => {
  it('joins while active, renders only on-screen walkers, and counts bad payloads', async () => {
    const { state, hook } = await setup();
    expect(state.joins).toBe(1);

    await act(async () => {
      state.handlers!.onStatus('live' as LiveWalkStatus);
      state.handlers!.onPosition(position('walker-01', 40.001), Date.now());
      state.handlers!.onPosition(position('walker-02', 40.002), Date.now());
      state.handlers!.onPosition(position('walker-03', 40.5), Date.now()); // far off screen
      state.handlers!.onPosition({ participantId: 'walker-04', latitude: 'x' }, Date.now());
    });

    await waitFor(() => expect(hook.result.current.frame.total).toBe(3));
    expect(hook.result.current.status).toBe('live');
    expect(hook.result.current.frame.visible.map((p) => p.participantId).sort()).toEqual([
      'walker-01',
      'walker-02',
    ]);
    expect(hook.result.current.counters.invalid).toBe(1);
  });

  it('leaves the channel and stops rendering when it becomes inactive', async () => {
    const { state, hook } = await setup();
    await hook.rerender({ active: false });
    expect(state.leaves).toBe(1);
    await act(async () => {
      state.handlers!.onPosition(position('walker-09', 40.001), Date.now());
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(hook.result.current.frame.total).toBe(0);
  });

  it('does not join at all while inactive', async () => {
    const { state } = await setup(false);
    expect(state.joins).toBe(0);
  });
});
