import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LiveWalkStatus } from '../../core/ports';
import { useServices } from '../../core/services';
import {
  cullToViewport,
  PositionTracker,
  type Region,
  type RenderedParticipant,
  type TrackerOptions,
} from './engine';

export interface LiveWalkFrame {
  visible: RenderedParticipant[];
  total: number;
}

/**
 * Joins the live channel while `active` (screen focused + app in the
 * foreground) and renders at a fixed, modest frame rate.
 *
 * Network messages never trigger React renders: they only update the
 * tracker. One timer per screen takes a snapshot, culls it to the viewport
 * and sets state once per frame. When inactive, the channel is left and
 * the timer stops (no socket traffic, no wake-ups in the background).
 */
export function useLiveWalk(
  meetupId: string,
  regionRef: RefObject<Region>,
  active: boolean,
  frameMs = 66,
  trackerOptions?: TrackerOptions,
) {
  const { liveWalk } = useServices();
  const trackerRef = useRef<PositionTracker | null>(null);
  trackerRef.current ??= new PositionTracker(trackerOptions);
  const tracker = trackerRef.current;
  const [status, setStatus] = useState<LiveWalkStatus>('joining');
  const [frame, setFrame] = useState<LiveWalkFrame>({ visible: [], total: 0 });

  useEffect(() => {
    if (!active) return;
    return liveWalk.join(meetupId, {
      onPosition: (payload, receivedAt) => {
        tracker.ingest(payload, receivedAt);
      },
      onStatus: setStatus,
    });
  }, [active, liveWalk, meetupId, tracker]);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const now = Date.now();
      tracker.prune(now);
      const all = tracker.positionsAt(now);
      setFrame({ visible: cullToViewport(all, regionRef.current), total: all.length });
    }, frameMs);
    return () => clearInterval(timer);
  }, [active, frameMs, regionRef, tracker]);

  return { status, frame, counters: tracker.counters };
}
