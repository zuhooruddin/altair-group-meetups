// Applies supabase/migrations to the hosted database with the Supabase CLI:
//   supabase db push --db-url $DATABASE_URL
// Reads DATABASE_URL from the repo-root .env so it works the same in any
// shell (cmd, PowerShell, bash) and never echoes the connection string.
// Extra arguments are passed through, e.g. `npm run db:push -- --dry-run`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = resolve(import.meta.dirname, '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const result = spawnSync(
  'npx',
  ['supabase', 'db', 'push', '--db-url', process.env.DATABASE_URL, ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: resolve(import.meta.dirname, '..'),
  },
);
process.exit(result.status ?? 1);
