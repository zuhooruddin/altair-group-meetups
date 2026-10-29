import type { TokenVerifier } from '../../src/domain/ports';
import { buildApp } from '../../src/http/app';
import { PgUnitOfWork } from '../../src/infrastructure/db/unit-of-work';
import { TEST_TITLE_PREFIX, users, type Persona } from './fixtures';
import type { ApiHarness } from './harness';
import { readSql, referenceMeetupsSeedPath } from './paths';
import { createSeededPglite, PglitePool } from './pglite-db';

const OFFLINE_TOKEN_PREFIX = 'offline-test-token:';

/**
 * Offline stand-in for Supabase Auth: accepts only tokens it minted for a
 * seed user. Everything after token verification is the production code.
 */
class OfflineTokenVerifier implements TokenVerifier {
  async verify(token: string) {
    if (!token.startsWith(OFFLINE_TOKEN_PREFIX)) return null;
    const userId = token.slice(OFFLINE_TOKEN_PREFIX.length);
    return (Object.values(users) as string[]).includes(userId) ? { userId } : null;
  }
}

export async function createOfflineHarness(): Promise<ApiHarness> {
  const db = await createSeededPglite();
  const pool = new PglitePool(db);
  const app = buildApp({ uow: new PgUnitOfWork(pool), tokenVerifier: new OfflineTokenVerifier() });
  await app.ready();

  const ownerExec = async (sql: string, params?: unknown[]) => {
    const client = await pool.connect();
    try {
      if (params) await client.query(sql, params);
      else await db.exec(sql);
    } finally {
      client.release();
    }
  };

  return {
    app,
    tokenFor: async (persona: Persona) => `${OFFLINE_TOKEN_PREFIX}${users[persona]}`,
    ownerExec,
    resetData: async () => {
      await ownerExec(`delete from public.meetups where title like '${TEST_TITLE_PREFIX}%'`);
      await ownerExec(readSql(referenceMeetupsSeedPath));
    },
    close: async () => {
      await app.close();
      await db.close();
    },
  };
}
