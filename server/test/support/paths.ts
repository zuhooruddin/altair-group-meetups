import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const migrationsDir = join(repoRoot, 'supabase', 'migrations');

/** Migration files in apply order (timestamp prefix). */
export function migrationFiles(): string[] {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(migrationsDir, f));
}

export const readSql = (path: string) => readFileSync(path, 'utf8');

/** The provided seed, unchanged (PART 1 runs; PART 2 is commented out in it). */
export const providedSeedPath = join(repoRoot, 'altair-seed-data.sql');

/** Our adapted, idempotent PART 2. */
export const referenceMeetupsSeedPath = join(
  repoRoot,
  'supabase',
  'seed',
  'part2_reference_meetups.sql',
);
