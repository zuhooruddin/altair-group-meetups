import type { FastifyInstance } from 'fastify';
import type { Persona } from './fixtures';

/**
 * What the shared API suite needs from an environment. Implemented by the
 * offline harness (PGlite) and the hosted harness (Supabase).
 */
export interface ApiHarness {
  /** The real app (real services, real repositories, real SQL). */
  app: FastifyInstance;
  /** A bearer token for the persona (real Supabase session when hosted). */
  tokenFor(persona: Persona): Promise<string>;
  /** Runs SQL as the database owner (test setup only, e.g. a started meetup). */
  ownerExec(sql: string, params?: unknown[]): Promise<void>;
  /** Restores the three reference meetups and removes meetups created by tests. */
  resetData(): Promise<void>;
  close(): Promise<void>;
}
