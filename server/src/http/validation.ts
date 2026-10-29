import type { z } from 'zod';
import { AppError } from '../domain/errors';

/** Validates untrusted input with a shared schema; 400 with field-level issues on failure. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown, what: string): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new AppError(
    'VALIDATION_FAILED',
    `Invalid ${what}`,
    result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '(root)',
      message: issue.message,
    })),
  );
}

/**
 * Shapes outgoing data with the shared response schema. Zod drops any key
 * the contract does not declare, so nothing outside the contract (a home
 * location, an internal column) can ride along in a response by accident.
 */
export function toResponse<S extends z.ZodType>(schema: S, value: z.input<S>): z.infer<S> {
  return schema.parse(value);
}
