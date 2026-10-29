import { AppError, meetupCancelled, meetupStarted, notFound } from '../../domain/errors';

interface DatabaseErrorLike {
  code?: unknown;
}

const isDatabaseError = (error: unknown): error is DatabaseErrorLike & Error =>
  error instanceof Error && typeof (error as DatabaseErrorLike).code === 'string';

/**
 * Translates database errors into safe application errors. The custom
 * SQLSTATEs come from the triggers/functions in the migrations. Unknown
 * errors pass through unchanged and end up as a logged, generic 500.
 */
export function translateDatabaseError(error: unknown): unknown {
  if (!isDatabaseError(error)) return error;
  switch (error.code) {
    case 'AL001':
      return notFound('Meetup');
    case 'AL002':
    case 'AL004':
      return meetupCancelled();
    case 'AL003':
      return meetupStarted();
    case 'AL006':
      return new AppError('START_TIME_NOT_IN_FUTURE', 'Start time must be in the future');
    case 'AL005':
      return new AppError('FORBIDDEN', 'That change is not allowed');
    case '42501': // insufficient_privilege, incl. "new row violates row-level security policy"
      return new AppError('FORBIDDEN', 'You are not allowed to do that');
    case '23514': // check_violation
    case '22P02': // invalid_text_representation
    case '22003': // numeric_value_out_of_range
      return new AppError('VALIDATION_FAILED', 'Invalid input');
    case '23503': // foreign_key_violation: e.g. the group or meetup vanished mid-request
      return notFound('Meetup');
    default:
      return error;
  }
}
