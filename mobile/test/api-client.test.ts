import { meetupDetailResponseSchema } from '@altair/shared';
import { ApiClient } from '../src/core/api/api-client';
import { ApiError } from '../src/core/api/api-error';
import { detail } from './helpers';

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('ApiClient', () => {
  it('sends the bearer token and parses the response with the shared schema', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, { meetup: detail() }));
    const client = new ApiClient('http://api.test', async () => 'abc', fetchImpl as unknown as typeof fetch);
    const result = await client.request('GET', '/v1/meetups/x', meetupDetailResponseSchema);
    expect(result.meetup.title).toBe('Saturday morning loop');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/v1/meetups/x');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc');
  });

  it('turns the shared error body into an ApiError with code and field issues', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(400, { error: { code: 'VALIDATION_FAILED', message: 'Invalid meetup', issues: [{ path: 'title', message: 'Title is required' }] } }),
    );
    const client = new ApiClient('http://api.test', async () => 'abc', fetchImpl as unknown as typeof fetch);
    await expect(client.request('POST', '/v1/meetups', meetupDetailResponseSchema, {})).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 400,
      issues: [{ path: 'title', message: 'Title is required' }],
    });
  });

  it('refuses a response that breaks the contract instead of trusting it', async () => {
    const broken = { meetup: { ...detail(), meetingPoint: { visibility: 'approximate', centerLatitude: 40, centerLongitude: -100 } } };
    const client = new ApiClient('http://api.test', async () => 'abc', (async () => jsonResponse(200, broken)) as unknown as typeof fetch);
    await expect(client.request('GET', '/v1/meetups/x', meetupDetailResponseSchema)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('reports network failures and missing sessions clearly', async () => {
    const offline = new ApiClient('http://api.test', async () => 'abc', (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch);
    await expect(offline.request('GET', '/x', meetupDetailResponseSchema)).rejects.toMatchObject({ code: 'NETWORK' });

    const signedOut = new ApiClient('http://api.test', async () => null);
    await expect(signedOut.request('GET', '/x', meetupDetailResponseSchema)).rejects.toBeInstanceOf(ApiError);
  });
});
