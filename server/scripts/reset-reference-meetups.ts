// Re-runs supabase/seed/part2_reference_meetups.sql as the database owner:
// restores the three reference meetups (fresh start times, seed RSVPs) and
// leaves every other meetup alone. Handy before a demo.
import pg from 'pg';
import { loadDotEnv, readServerEnv } from '../src/config/env';
import { readSql, referenceMeetupsSeedPath } from '../test/support/paths';

loadDotEnv();
const env = readServerEnv();
const client = new pg.Client({ connectionString: env.DATABASE_URL });
await client.connect();
try {
  await client.query(readSql(referenceMeetupsSeedPath));
  const { rows } = await client.query<{ title: string; starts_at: Date; rsvps: number }>(
    `select m.title, m.starts_at, (select count(*)::int from public.rsvps r where r.meetup_id = m.id) as rsvps
       from public.meetups m where m.id::text like 'c3000000-%' order by m.starts_at`,
  );
  for (const r of rows)
    console.log(`${r.title.padEnd(24)} ${r.starts_at.toISOString()}  RSVPs: ${r.rsvps}`);
} finally {
  await client.end();
}
