# Bonus (b): live walk map, a work sample

Animated avatars from Supabase Realtime **Broadcast** with interpolation and viewport culling.
Positions are **synthetic** (a simulator script); no real or home location is read, sent or shown.

**Map SDK.** react-native-maps, not Mapbox. The brief accepts any SDK for this bonus, and
react-native-maps runs in Expo Go with no account, token or development build, so a reviewer can
run it. The rendering approach below is SDK-independent; on Mapbox I'd use a `ShapeSource` +
`SymbolLayer` (GPU-side symbols) instead of view markers.

## Architecture

```
simulate-live-walk.ts ──broadcast──▶ Realtime (private channel meetup:<id>:live) ──▶ app
 (signs in as an attendee)             RLS on realtime.messages decides who joins     │
                                                                                      ▼
   LiveWalkGateway.join ─▶ PositionTracker.ingest (validate, order, staleness) ─ no React render
   15 fps timer ─▶ positionsAt(now − 2.5 s) ─▶ cullToViewport(+20 %) ─▶ setState once per frame
```

- **Authorization**: the channel is `private: true`. Policies on `realtime.messages`
  (`20261029150000_live_walk_realtime.sql`) allow receive/send only to the meetup's creator and
  attendees who are still group members, and only while it is scheduled: the same audience as the
  exact meeting point. Tested offline for creator/attendee/non-RSVP/outsider/other-group/cancelled/
  malformed topics.
- **Contract**: `livePositionSchema` in `packages/shared` (participant slug, lat/lng, sender `ts`,
  per-participant `seq`), strict, so an extra field is rejected.

## Interpolation, ordering, staleness

- **Render delay** of 2.5 s (slightly more than the 2 s send interval) means there are usually two
  samples around the render time, so markers glide instead of jump. After the newest sample they
  **hold** (no extrapolation, so a stalled sender never walks off in a straight line).
- **Clock skew**: sender and device clocks differ. The tracker keeps the minimum observed
  `receivedAt − ts` (network delay only adds to it) as the clock offset and maps sender time onto
  the device clock.
- **Out-of-order / duplicate**: dropped by `seq` per participant, so markers never move backwards.
- **Stale**: dropped when delivery is more than 8 s slower than the fastest seen; participants
  silent for 30 s are removed.

## Viewport culling and rendering cost

Only walkers inside the visible region **plus a 20 % margin** are mounted (the margin means a
walker entering the screen is already there). The region is held in a ref and updated on
`onRegionChangeComplete`, so panning causes no extra renders. Avatar views are rasterised once
(`tracksViewChanges` turns off after 500 ms) and memoised; a frame moves native coordinates only.
Network messages never trigger React renders: one timer per screen renders at most 15 fps.

## Latency vs battery vs network

| Knob          | Value here                  | Trade-off                                                                                                                                  |
| ------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Send interval | 2 s                         | Halving it doubles radio wake-ups and messages for a walk at ~1.4 m/s, where 2 s ≈ 3 m of movement: invisible at walking-map zoom.         |
| Render delay  | 2.5 s                       | Smoothness vs freshness: what you see is ~2.5 s old. Fine for "where is the group", wrong for turn-by-turn.                                |
| Frame rate    | 15 fps                      | Smooth enough for walking pace; a third of the JS work of 60 fps. Native animated markers would offload it, at the cost of harder testing. |
| Background    | channel left, timer stopped | Zero socket traffic and wake-ups when not on screen; costs a re-join on return.                                                            |

Payload is ~120 bytes of JSON; at 12 walkers every 2 s that is ~6 messages/s per channel, about
0.7 KB/s down per viewer. A production sender would also skip sending when stationary, batch
several walkers per message, and drop precision to ~5 decimals.

## Scalability and how I'd load-test it

The cost driver is **fan-out**: messages/s × subscribers per channel. Walking groups are small
(tens), so channels stay small; the risk is many concurrent channels. To load-test: a k6 or Node
harness opening N private channels (realistic: 10–30 subscribers, 5–15 senders each) against a
staging project, ramping N; measure end-to-end latency (sender `ts` → receive, with synced clocks),
delivery ratio, and Realtime's per-project message/connection quotas; separately, on a low-end
Android device, profile the screen with 50/200/500 participants (JS frame time, UI thread, memory)
with and without culling. **None of these have been run yet; no numbers are claimed.**

## Known limitations

- The simulator, not real devices, produces positions; there is no consent flow because there is
  no real tracking (see ENGINEERING_NOTES.md, "refuse to build first").
- The clock-offset estimate only ever decreases, so samples received before a faster delivery are
  placed slightly later than the ones after it; harmless at a 2.5 s render delay.
- View markers do not scale to hundreds of walkers on screen; that is where a GPU symbol layer
  (Mapbox `SymbolLayer`) is the right tool.
