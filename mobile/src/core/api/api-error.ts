import type { ApiErrorCode } from '@altair/shared';

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode | 'NETWORK' | 'BAD_RESPONSE',
    message: string,
    readonly status: number,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** A message that is safe and useful to show the member. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}
