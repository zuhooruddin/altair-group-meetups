import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TokenVerifier } from '../../domain/ports';
import type { Actor } from '../../domain/types';

/**
 * Verifies an access token with Supabase Auth (GET /auth/v1/user). This
 * checks signature, expiry and that the session has not been revoked, and
 * works for both legacy (HS256) and asymmetric signing keys.
 * Uses the public anon key only; the service-role key is never needed.
 */
export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly client: SupabaseClient;

  constructor(supabaseUrl: string, anonKey: string) {
    this.client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async verify(accessToken: string): Promise<Actor | null> {
    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error || !data.user) return null;
    return { userId: data.user.id };
  }
}
