// Read-only snapshot of the hosted database before/after migrations:
// Postgres version, public tables, applied CLI migrations, seed counts.
// Never prints connection details.
import pg from 'pg';
import { loadDotEnv, readServerEnv } from '../src/config/env';

loadDotEnv();
const client = new pg.Client({ connectionString: readServerEnv().DATABASE_URL });
await client.connect();
try {
  await client.query('begin transaction read only');
  const version = await client.query<{ v: string }>(
    `select current_setting('server_version') as v`,
  );
  console.log(
    `postgres ${version.rows[0]?.v}; connected as ${(await client.query('select current_user as u')).rows[0].u}`,
  );

  const tables = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`,
  );
  console.log(`public tables: ${tables.rows.map((r) => r.table_name).join(', ') || '(none)'}`);

  const hasHistory = await client.query<{ ok: boolean }>(
    `select to_regclass('supabase_migrations.schema_migrations') is not null as ok`,
  );
  if (hasHistory.rows[0]?.ok) {
    const applied = await client.query<{ version: string; name: string | null }>(
      `select version, name from supabase_migrations.schema_migrations order by version`,
    );
    console.log(
      `CLI migration history: ${applied.rows.map((r) => `${r.version}${r.name ? ` ${r.name}` : ''}`).join(', ') || '(empty)'}`,
    );
  } else {
    console.log('CLI migration history: (none)');
  }

  const names = new Set(tables.rows.map((r) => r.table_name));
  const count = async (sql: string) =>
    Number((await client.query<{ n: string }>(sql)).rows[0]?.n ?? 0);
  if (names.has('users')) {
    console.log(
      `seed: auth.users(example.test)=${await count(`select count(*) as n from auth.users where email like '%@example.test'`)}, ` +
        `users=${await count('select count(*) as n from public.users')}, ` +
        `groups=${await count('select count(*) as n from public.groups')}, ` +
        `memberships=${await count('select count(*) as n from public.group_memberships')}`,
    );
  }
  if (names.has('meetups')) {
    console.log(
      `meetups=${await count('select count(*) as n from public.meetups')}, ` +
        `meeting_points=${await count('select count(*) as n from public.meetup_meeting_points')}, ` +
        `rsvps=${await count('select count(*) as n from public.rsvps')}`,
    );
  }
  const roles = await client.query<{ rolname: string }>(
    `select rolname from pg_roles where rolname in ('altair_api_writer', 'authenticated', 'anon') order by 1`,
  );
  console.log(`roles present: ${roles.rows.map((r) => r.rolname).join(', ')}`);
  await client.query('rollback');
} finally {
  await client.end();
}
