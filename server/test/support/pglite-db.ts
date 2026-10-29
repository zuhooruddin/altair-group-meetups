import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PooledSqlClient, SqlPool } from '../../src/infrastructure/db/sql-client';
import { migrationFiles, providedSeedPath, readSql, referenceMeetupsSeedPath } from './paths';

const shimPath = join(dirname(fileURLToPath(import.meta.url)), 'supabase-shim.sql');

/**
 * Embedded Postgres 17 (PGlite) with the Supabase shim, every migration, the
 * provided seed (PART 1) and our PART 2 applied, in that order.
 */
export async function createSeededPglite(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readSql(shimPath));
  for (const file of migrationFiles()) {
    try {
      await db.exec(readSql(file));
    } catch (error) {
      throw new Error(`migration ${file} failed: ${(error as Error).message}`);
    }
  }
  await db.exec(readSql(providedSeedPath));
  await db.exec(readSql(referenceMeetupsSeedPath));
  return db;
}

/**
 * Exposes PGlite through the SqlPool port. PGlite is a single session, so
 * connections are handed out one at a time (a simple FIFO lock).
 */
export class PglitePool implements SqlPool {
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly db: PGlite) {}

  async connect(): Promise<PooledSqlClient> {
    let unlock!: () => void;
    const previous = this.tail;
    this.tail = new Promise<void>((resolve) => (unlock = resolve));
    await previous;

    const db = this.db;
    let released = false;
    return {
      async query<R extends Record<string, unknown>>(text: string, params?: unknown[]) {
        const result = await db.query<R>(text, params as never[]);
        return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
      },
      release() {
        if (released) return;
        released = true;
        unlock();
      },
    };
  }
}
