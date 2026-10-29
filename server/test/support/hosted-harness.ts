import pg from 'pg';
import { buildApp } from '../../src/http/app';
import { SupabaseTokenVerifier } from '../../src/infrastructure/auth/supabase-token-verifier';
import { PgUnitOfWork } from '../../src/infrastructure/db/unit-of-work';
import { TEST_TITLE_PREFIX } from './fixtures';
import type { ApiHarness } from './harness';
import { accessTokenFor, hostedEnv } from './hosted-env';
import { readSql, referenceMeetupsSeedPath } from './paths';

/** The production composition, pointed at the hosted project from .env. */
export async function createHostedHarness(): Promise<ApiHarness> {
  const env = hostedEnv();
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });
  const app = buildApp({
    uow: new PgUnitOfWork(pool),
    tokenVerifier: new SupabaseTokenVerifier(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
  });
  await app.ready();

  // DATABASE_URL connects as the database owner: test setup only.
  const ownerExec = async (sql: string, params?: unknown[]) => {
    await pool.query(sql, params);
  };

  return {
    app,
    tokenFor: accessTokenFor,
    ownerExec,
    resetData: async () => {
      await ownerExec(`delete from public.meetups where title like '${TEST_TITLE_PREFIX}%'`);
      await ownerExec(readSql(referenceMeetupsSeedPath));
    },
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}
