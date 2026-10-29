import { describe, expect, it } from 'vitest';
import type { Repositories, TokenVerifier, UnitOfWork } from '../../src/domain/ports';
import { buildApp } from '../../src/http/app';
import { translateDatabaseError } from '../../src/infrastructure/db/pg-errors';

const verifier: TokenVerifier = {
  verify: async (token) =>
    token === 'good' ? { userId: 'a1000000-0000-4000-8000-000000000003' } : null,
};

/** A unit of work whose repositories throw whatever the test wants. */
function failingUow(error: unknown): UnitOfWork {
  const run = async <T>(_a: unknown, work: (r: Repositories) => Promise<T>) => {
    const boom = async () => {
      throw translateDatabaseError(error);
    };
    const repos = {
      groups: { listMine: boom, findVisible: boom },
      meetups: { listByGroup: boom, findVisible: boom, create: boom, cancel: boom },
      rsvps: { listAttendees: boom, addForCaller: boom, removeForCaller: boom },
    } as unknown as Repositories;
    return work(repos);
  };
  return { read: run, write: run };
}

const dbError = (code: string, message = 'db says no') =>
  Object.assign(new Error(message), { code });

describe('error boundary', () => {
  it('turns an unexpected database error into a generic 500 with no internals', async () => {
    const app = buildApp({
      uow: failingUow(
        dbError('XX000', 'relation "public.meetup_meeting_points" ... North gate 40.012046'),
      ),
      tokenVerifier: verifier,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/groups',
      headers: { authorization: 'Bearer good' },
    });
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body)).toEqual({
      error: { code: 'INTERNAL', message: 'Something went wrong' },
    });
    expect(res.body).not.toMatch(/relation|North gate|40\.012046/);
  });

  it.each([
    ['AL001', 404, 'NOT_FOUND'],
    ['AL002', 409, 'MEETUP_CANCELLED'],
    ['AL003', 409, 'MEETUP_STARTED'],
    ['AL004', 409, 'MEETUP_CANCELLED'],
    ['AL006', 400, 'START_TIME_NOT_IN_FUTURE'],
    ['42501', 403, 'FORBIDDEN'],
    ['23514', 400, 'VALIDATION_FAILED'],
  ])('maps SQLSTATE %s to %i %s', async (sqlstate, status, code) => {
    const app = buildApp({ uow: failingUow(dbError(sqlstate)), tokenVerifier: verifier });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/groups',
      headers: { authorization: 'Bearer good' },
    });
    expect(res.statusCode).toBe(status);
    expect(JSON.parse(res.body).error.code).toBe(code);
    expect(res.body).not.toContain('db says no');
  });

  it('unknown routes get the standard error shape', async () => {
    const app = buildApp({ uow: failingUow(new Error('x')), tokenVerifier: verifier });
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error.code).toBe('NOT_FOUND');
  });
});
