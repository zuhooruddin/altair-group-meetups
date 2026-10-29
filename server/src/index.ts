import pg from 'pg';
import { loadDotEnv, readServerEnv } from './config/env';
import { buildApp } from './http/app';
import { SupabaseTokenVerifier } from './infrastructure/auth/supabase-token-verifier';
import { PgUnitOfWork } from './infrastructure/db/unit-of-work';

// Composition root: the only place that knows about concrete adapters.
async function main() {
  loadDotEnv();
  const env = readServerEnv();

  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });
  pool.on('error', (err) => console.error('postgres pool error', err.message));

  const app = buildApp({
    uow: new PgUnitOfWork(pool),
    tokenVerifier: new SupabaseTokenVerifier(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
    logger: {
      level: env.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await app.listen({ host: env.HOST, port: env.PORT });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
