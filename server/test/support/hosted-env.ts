import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadDotEnv, readServerEnv, type ServerEnv } from '../../src/config/env';
import { emails, FIXTURE_PASSWORD, type Persona } from './fixtures';

let cached: ServerEnv | undefined;

/** Hosted tests need the same .env as the server; fail loudly if it is missing. */
export function hostedEnv(): ServerEnv {
  if (cached) return cached;
  loadDotEnv();
  try {
    cached = readServerEnv();
  } catch (error) {
    throw new Error(
      `Hosted tests need SUPABASE_URL, SUPABASE_ANON_KEY and DATABASE_URL in the repo-root .env.\n${(error as Error).message}`,
    );
  }
  return cached;
}

export function anonClient(): SupabaseClient {
  const env = hostedEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const sessions = new Map<Persona, string>();

/** Signs a seed account in with Supabase Auth (cached per run). */
export async function accessTokenFor(persona: Persona): Promise<string> {
  const existing = sessions.get(persona);
  if (existing) return existing;
  const { data, error } = await anonClient().auth.signInWithPassword({
    email: emails[persona],
    password: FIXTURE_PASSWORD,
  });
  if (error || !data.session) throw new Error(`sign-in failed for ${persona}: ${error?.message}`);
  sessions.set(persona, data.session.access_token);
  return data.session.access_token;
}

/** A Data API (PostgREST) client acting as the persona: what the app could do directly. */
export async function clientAs(persona: Persona): Promise<SupabaseClient> {
  const env = hostedEnv();
  const token = await accessTokenFor(persona);
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
