import type { ApiErrorCode } from '@altair/shared';

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_FAILED: 400,
  START_TIME_NOT_IN_FUTURE: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  MEETUP_CANCELLED: 409,
  MEETUP_STARTED: 409,
  INTERNAL: 500,
};

export interface ErrorIssue {
  path: string;
  message: string;
}

/**
 * An error that is safe to show the caller. Messages must never contain
 * protected data (another group's meetup, a place name, coordinates...).
 */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly issues?: ErrorIssue[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusByCode[code];
  }
}

// One message per case, so a member and an outsider asking about a meetup
// they cannot see get byte-identical responses.
export const notFound = (what: 'Meetup' | 'Group') =>
  new AppError('NOT_FOUND', `${what} not found`);
export const meetupCancelled = () =>
  new AppError('MEETUP_CANCELLED', 'This meetup has been cancelled and no longer accepts RSVPs');
export const meetupStarted = () =>
  new AppError('MEETUP_STARTED', 'This meetup has already started and no longer accepts RSVPs');
