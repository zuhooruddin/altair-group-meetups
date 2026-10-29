// Recording aid: shows, as real seed users, what the API and Supabase's Data API
// return for an outsider and for a member who has not RSVP'd, plus the write-path
// and validation guarantees. Needs the API server running (npm run server).
// Prints results only; never prints keys or tokens.
//
//   npm run demo:privacy
import { loadDotEnv, readServerEnv } from '../src/config/env';
import { FIXTURE_PASSWORD, meetups } from '../test/support/fixtures';

loadDotEnv();
const env = readServerEnv();
const API = process.env.API_URL ?? `http://localhost:${env.PORT}`;
const SAT = meetups.saturdayLoop;

async function token(name: string): Promise<string> {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${name}@example.test`, password: FIXTURE_PASSWORD }),
  });
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`sign-in failed for ${name}`);
  return body.access_token;
}

async function api(jwt: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as ApiBody };
}

/** The parts of API / PostgREST responses this demo prints. */
interface ApiBody {
  code?: string;
  error?: { code?: string; issues?: { message: string }[] };
  item?: { meetingPoint?: { visibility?: string; radiusMeters?: number } };
}

async function rest(jwt: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const line = (label: string, result: string) => console.log(`  ${label.padEnd(46)} ${result}`);
const brief = (r: { status: number; body: unknown }) => {
  const b = (Array.isArray(r.body) ? {} : (r.body ?? {})) as ApiBody;
  const list = Array.isArray(r.body) ? JSON.stringify(r.body) : '';
  return `${r.status} ${b.error?.code ?? b.code ?? ''} ${list}`.trim();
};

const taylor = await token('taylor');
const sam = await token('sam');

console.log('\n1. Taylor is signed in but in no group (outsider)');
line('API  GET my groups', JSON.stringify((await api(taylor, 'GET', '/v1/me/groups')).body));
line('API  GET Saturday loop detail', brief(await api(taylor, 'GET', `/v1/meetups/${SAT}`)));
line(
  'API  GET Saturday loop attendees',
  brief(await api(taylor, 'GET', `/v1/meetups/${SAT}/attendees`)),
);
line('API  GET Saturday loop map', brief(await api(taylor, 'GET', `/v1/meetups/${SAT}/map`)));
line('Supabase directly: meetups', brief(await rest(taylor, 'meetups?select=*')));
line('Supabase directly: rsvps (attendees)', brief(await rest(taylor, 'rsvps?select=*')));
line(
  'Supabase directly: exact meeting points',
  brief(await rest(taylor, 'meetup_meeting_points?select=*')),
);

console.log("\n2. Sam is in the group but has not RSVP'd");
const samMap = await api(sam, 'GET', `/v1/meetups/${SAT}/map`);
const point = samMap.body.item?.meetingPoint ?? {};
line('API  meeting point visibility', `${point.visibility} (radius ${point.radiusMeters} m)`);
line(
  'API  place name in the response?',
  JSON.stringify(samMap.body).includes('North gate') ? 'YES (bug)' : 'no',
);
line(
  'Supabase directly: exact meeting points',
  brief(await rest(sam, 'meetup_meeting_points?select=*')),
);
line('Supabase directly: users.home_lat', brief(await rest(sam, 'users?select=home_lat')));

console.log('\n3. Writes only go through the API');
line(
  'Supabase directly: insert an RSVP',
  brief(
    await rest(sam, 'rsvps', {
      method: 'POST',
      body: JSON.stringify({ meetup_id: SAT, user_id: 'a1000000-0000-4000-8000-000000000003' }),
    }),
  ),
);
const past = await api(sam, 'POST', '/v1/meetups', {
  groupId: 'b2000000-0000-4000-8000-000000000001',
  title: 'Yesterday walk',
  startsAt: new Date(Date.now() - 3_600_000).toISOString(),
  meetingPoint: {
    placeName: 'Fountain plaza, Town Green',
    latitude: 39.999134,
    longitude: -99.999461,
  },
});
line(
  'API  create with a start time in the past',
  `${past.status} ${past.body.error?.code}: ${past.body.error?.issues?.[0]?.message}`,
);
console.log('');
