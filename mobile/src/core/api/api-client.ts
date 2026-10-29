import { apiErrorBodySchema } from '@altair/shared';
import type { z } from 'zod';
import { ApiError } from './api-error';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Thin HTTP client for the ALTAIR API. Attaches the member's access token
 * and parses every response with the shared contract, so a response that
 * does not match the contract is an error, not silently trusted data.
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: () => Promise<string | null>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async request<S extends z.ZodType>(method: Method, path: string, responseSchema: S, body?: unknown): Promise<z.infer<S>> {
    const token = await this.accessToken();
    if (!token) throw new ApiError('UNAUTHENTICATED', 'Please sign in again.', 401);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ApiError('NETWORK', 'Could not reach the server. Check your connection and try again.', 0);
    }

    const payload: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      const parsed = apiErrorBodySchema.safeParse(payload);
      if (parsed.success) {
        const { code, message, issues } = parsed.data.error;
        throw new ApiError(code, message, response.status, issues ?? []);
      }
      throw new ApiError('BAD_RESPONSE', `Unexpected server response (${response.status}).`, response.status);
    }

    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) throw new ApiError('BAD_RESPONSE', 'Unexpected response from the server.', response.status);
    return parsed.data;
  }
}
