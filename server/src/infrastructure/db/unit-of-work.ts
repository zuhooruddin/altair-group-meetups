import type { Repositories, UnitOfWork } from '../../domain/ports';
import type { Actor } from '../../domain/types';
import { PgGroupRepository } from '../repositories/groups.repository';
import { PgMeetupRepository } from '../repositories/meetups.repository';
import { PgRsvpRepository } from '../repositories/rsvps.repository';
import { translateDatabaseError } from './pg-errors';
import type { SqlClient, SqlPool } from './sql-client';

type MemberRole = 'authenticated' | 'altair_api_writer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs each unit of work in its own transaction, bound to the member:
 *
 *   SET LOCAL ROLE authenticated | altair_api_writer
 *   set_config('request.jwt.claims', '{"sub": <verified user id>}', true)
 *
 * Both settings are transaction-local, so a pooled connection never carries
 * one member's identity into another request. Row-level security then
 * applies exactly as it does for the member's own PostgREST requests.
 */
export class PgUnitOfWork implements UnitOfWork {
  constructor(
    private readonly pool: SqlPool,
    private readonly statementTimeoutMs = 5000,
  ) {}

  read<T>(actor: Actor, work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.run(actor, 'authenticated', true, work);
  }

  write<T>(actor: Actor, work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.run(actor, 'altair_api_writer', false, work);
  }

  private async run<T>(
    actor: Actor,
    role: MemberRole,
    readOnly: boolean,
    work: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    // Defence in depth: the id comes from a verified token, but it is still
    // checked before it goes anywhere near the session.
    if (!UUID.test(actor.userId)) throw new Error('Refusing to bind a non-UUID actor id');

    const client = await this.pool.connect();
    let failed = false;
    try {
      await client.query(readOnly ? 'begin transaction read only' : 'begin');
      // `role` is one of two literals above, never caller input.
      await client.query(`set local role ${role}`);
      await client.query(`select set_config('statement_timeout', $1, true)`, [
        String(this.statementTimeoutMs),
      ]);
      await client.query(`select set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: actor.userId, role: 'authenticated' }),
      ]);
      const result = await work(repositoriesFor(client));
      await client.query('commit');
      return result;
    } catch (error) {
      failed = true;
      await client.query('rollback').catch(() => undefined);
      throw translateDatabaseError(error);
    } finally {
      client.release(failed ? undefined : false);
    }
  }
}

function repositoriesFor(client: SqlClient): Repositories {
  return {
    groups: new PgGroupRepository(client),
    meetups: new PgMeetupRepository(client),
    rsvps: new PgRsvpRepository(client),
  };
}
