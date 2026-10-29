import type { ApiErrorBody } from '@altair/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from '../domain/errors';

function body(error: AppError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.issues ? { issues: error.issues } : {}),
    },
  };
}

/**
 * One place that turns any thrown error into the shared error shape.
 * Unknown errors are logged in full server-side and reported to the caller
 * as a generic 500, so no SQL, stack or data ever reaches the client.
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, 'request failed');
      return reply.status(error.statusCode).send(body(error));
    }

    // Fastify's own 4xx errors: malformed JSON, wrong content type, too large...
    const status = (error as FastifyError).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(400).send(body(new AppError('VALIDATION_FAILED', 'Malformed request')));
    }

    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send(body(new AppError('INTERNAL', 'Something went wrong')));
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send(body(new AppError('NOT_FOUND', 'Route not found'))),
  );
}
