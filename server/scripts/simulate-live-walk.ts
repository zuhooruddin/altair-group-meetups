// Bonus work sample: broadcasts SYNTHETIC walker positions on a meetup's
// private live channel. No real person's location is used or read.
//
//   npm run live:simulate -- [meetupId] [--walkers 12] [--interval 2000] [--chaos]
//
// Signs in as a seed attendee (default jordan@example.test, who RSVP'd to
// "Saturday morning loop"), so it passes the same Realtime Authorization as
// the app: only the creator and attendees may send or receive.
// --chaos delays, duplicates and corrupts some messages to exercise the app's
// stale / out-of-order / invalid handling.
import { LIVE_POSITION_EVENT, liveWalkTopic, type LivePosition } from '@altair/shared';
import { createClient } from '@supabase/supabase-js';
import { loadDotEnv, readServerEnv } from '../src/config/env';
import { FIXTURE_PASSWORD, meetups } from '../test/support/fixtures';

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const meetupId = args.find((a) => /^[0-9a-f-]{36}$/i.test(a)) ?? meetups.saturdayLoop;
const walkerCount = flag('walkers', 12);
const intervalMs = flag('interval', 2000);
const chaos = args.includes('--chaos');

loadDotEnv();
const env = readServerEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const email = process.env.SIM_EMAIL ?? 'jordan@example.test';
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password: process.env.SIM_PASSWORD ?? FIXTURE_PASSWORD,
});
if (authError || !auth.session)
  throw new Error(`sign-in failed for ${email}: ${authError?.message}`);
await supabase.realtime.setAuth(auth.session.access_token);

// The exact point, read under RLS: only works for the creator or an attendee.
const { data: point } = await supabase
  .from('meetup_meeting_points')
  .select('latitude, longitude')
  .eq('meetup_id', meetupId)
  .maybeSingle();
if (!point) throw new Error(`${email} cannot see meetup ${meetupId}'s meeting point (RSVP first).`);

const M_PER_DEG = 111_320;
const walkers = Array.from({ length: walkerCount }, (_, i) => {
  const far = i % 4 === 3; // every 4th walker starts ~1.5 km away: off screen, to exercise culling
  return {
    id: `walker-${String(i + 1).padStart(2, '0')}`,
    seq: 0,
    radiusM: far ? 1500 + Math.random() * 500 : 80 + Math.random() * 450,
    angle: Math.random() * Math.PI * 2,
    // ~1.2-1.6 m/s walking pace along the circle
    speedRadPerSec: (1.2 + Math.random() * 0.4) / (far ? 1700 : 300),
  };
});

const channel = supabase.channel(liveWalkTopic(meetupId), {
  config: { private: true, broadcast: { self: false } },
});
await new Promise<void>((resolve, reject) =>
  channel.subscribe((status, err) => {
    if (status === 'SUBSCRIBED') resolve();
    else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
      reject(new Error(`could not join ${liveWalkTopic(meetupId)}: ${err?.message ?? status}`));
  }),
);

const send = (payload: unknown) =>
  channel.send({ type: 'broadcast', event: LIVE_POSITION_EVENT, payload });

console.log(
  `Broadcasting ${walkerCount} synthetic walkers every ${intervalMs} ms on ${liveWalkTopic(meetupId)}${chaos ? ' (chaos on)' : ''}. Ctrl-C to stop.`,
);

let sent = 0;
const tick = setInterval(() => {
  for (const w of walkers) {
    w.angle += w.speedRadPerSec * (intervalMs / 1000);
    w.seq += 1;
    const message: LivePosition = {
      participantId: w.id,
      latitude: point.latitude + (w.radiusM * Math.sin(w.angle)) / M_PER_DEG,
      longitude:
        point.longitude +
        (w.radiusM * Math.cos(w.angle)) / (M_PER_DEG * Math.cos((point.latitude * Math.PI) / 180)),
      ts: Date.now(),
      seq: w.seq,
    };
    if (chaos && Math.random() < 0.08) {
      setTimeout(() => void send(message), 3000 + Math.random() * 9000); // late / out of order
    } else {
      void send(message);
      if (chaos && Math.random() < 0.05) void send(message); // duplicate
    }
    if (chaos && Math.random() < 0.02) void send({ ...message, latitude: 'not-a-number' });
    sent += 1;
  }
  process.stdout.write(`\rsent ${sent} positions`);
}, intervalMs);

const stop = async () => {
  clearInterval(tick);
  await supabase.removeChannel(channel);
  console.log('\nstopped');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
