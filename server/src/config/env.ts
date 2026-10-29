import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_URL: z.url({
    message: 'SUPABASE_URL must be the project URL, e.g. https://xyz.supabase.co',
  }),
  SUPABASE_ANON_KEY: z.string().min(20, 'SUPABASE_ANON_KEY (publishable/anon key) is required'),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a postgres:// connection string'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Loads the repo-root .env (if present) without overriding real env vars. */
export function loadDotEnv(): void {
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '..', '.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source);
  if (!parsed.success) {
    // Names only, never values: these are secrets.
    const problems = parsed.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid server configuration (see .env.example):\n${problems}`);
  }
  return parsed.data;
}
