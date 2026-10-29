import type { FastifyRequest, onRequestAsyncHookHandler } from 'fastify';
import { AppError } from '../domain/errors';
import type { TokenVerifier } from '../domain/ports';
import type { Actor } from '../domain/types';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

const BEARER = /^Bearer\s+(\S+)$/i;

/** onRequest hook: every /v1 route requires a valid Supabase session. */
export function authenticate(verifier: TokenVerifier): onRequestAsyncHookHandler {
  return async (request) => {
    const match = BEARER.exec(request.headers.authorization ?? '');
    if (!match?.[1]) throw new AppError('UNAUTHENTICATED', 'Sign in required');
    const actor = await verifier.verify(match[1]);
    if (!actor) throw new AppError('UNAUTHENTICATED', 'Your session is invalid or has expired');
    request.actor = actor;
  };
}

export function actorOf(request: FastifyRequest): Actor {
  if (!request.actor) throw new AppError('UNAUTHENTICATED', 'Sign in required');
  return request.actor;
}
