// Loads the seed as the database owner (DATABASE_URL), equivalent to pasting
// the files into the hosted SQL editor:
//   1. altair-seed-data.sql (provided, unchanged): PART 1 accounts, profiles,
//      groups, memberships. Run in one transaction; skipped if the seed
//      accounts already exist, so it is never applied twice.
//   2. supabase/seed/part2_reference_meetups.sql: PART 2 adapted (idempotent).
import pg from 'pg';
import { loadDotEnv, readServerEnv } from '../src/config/env';
import { providedSeedPath, readSql, referenceMeetupsSeedPath } from '../test/support/paths';

loadDotEnv();
const client = new pg.Client({ connectionString: readServerEnv().DATABASE_URL });
await client.connect();
try {
  const existing = await client.query<{ n: number }>(
    `select count(*)::int as n from auth.users where email like '%@example.test'`,
  );
  if ((existing.rows[0]?.n ?? 0) > 0) {
    console.log(`PART 1 skipped: ${existing.rows[0]?.n} seed accounts already exist.`);
  } else {
    await client.query('begin');
    try {
      await client.query(readSql(providedSeedPath));
      await client.query('commit');
      console.log('PART 1 loaded (altair-seed-data.sql).');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  await client.query(readSql(referenceMeetupsSeedPath));
  console.log('PART 2 loaded (supabase/seed/part2_reference_meetups.sql).');

  const { rows } = await client.query(`
    select (select count(*)::int from auth.users where email like '%@example.test') as accounts,
           (select count(*)::int from auth.identities i join auth.users u on u.id = i.user_id
             where u.email like '%@example.test') as identities,
           (select count(*)::int from public.users) as profiles,
           (select count(*)::int from public.groups) as groups,
           (select count(*)::int from public.group_memberships) as memberships,
           (select count(*)::int from public.meetups) as meetups,
           (select count(*)::int from public.meetup_meeting_points) as meeting_points,
           (select count(*)::int from public.rsvps) as rsvps`);
  console.log(rows[0]);
} finally {
  await client.end();
}
