import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError } from './client';
import { clearSession, getSession, setSession } from '../auth/session';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('apiClient', () => {
  beforeEach(() => {
    clearSession();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    clearSession();
  });

  it('unwraps backend response envelopes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ code: 0, message: 'ok', data: { value: 42 } }),
    );

    await expect(apiClient<{ value: number }>('/health')).resolves.toEqual({
      value: 42,
    });
  });

  it('refreshes once after a 401 and retries with the new access token', async () => {
    setSession({ accessToken: 'old-access', refreshToken: 'refresh-token' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ code: 401, message: 'expired', data: null }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          code: 0,
          message: 'ok',
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ code: 0, message: 'ok', data: { ok: true } }),
      );
    globalThis.fetch = fetchMock;

    await expect(apiClient<{ ok: boolean }>('/secure')).resolves.toEqual({
      ok: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/admin/refresh',
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: 'refresh-token' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/secure',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer new-access',
        }),
      }),
    );
    expect(getSession()).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });

  it('shares one rotating refresh request across concurrent 401 responses', async () => {
    setSession({ accessToken: 'old-access', refreshToken: 'refresh-token' });
    let secureCalls = 0;
    let refreshCalls = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/admin/refresh')) {
        refreshCalls += 1;
        await Promise.resolve();
        return jsonResponse({
          code: 0,
          message: 'ok',
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        });
      }
      secureCalls += 1;
      if (secureCalls <= 2) {
        return jsonResponse(
          { code: 401, message: 'expired', data: null },
          { status: 401 },
        );
      }
      return jsonResponse({ code: 0, message: 'ok', data: { ok: true } });
    });

    await expect(
      Promise.all([
        apiClient<{ ok: boolean }>('/secure'),
        apiClient<{ ok: boolean }>('/secure'),
      ]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(getSession()).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
  });

  it('does not share or apply a refresh across administrator sessions', async () => {
    setSession({ accessToken: 'access-a', refreshToken: 'refresh-a' });
    const refreshA = deferred<Response>();
    const refreshTokens: string[] = [];
    const retryTokens: Record<string, string | null> = {};
    const secureCalls = new Map<string, number>();

    globalThis.fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/auth/admin/refresh')) {
          const refreshToken = JSON.parse(String(init?.body)).refreshToken;
          refreshTokens.push(refreshToken);
          if (refreshToken === 'refresh-a') return refreshA.promise;
          return jsonResponse({
            code: 0,
            message: 'ok',
            data: {
              accessToken: 'access-b-next',
              refreshToken: 'refresh-b-next',
            },
          });
        }

        const count = (secureCalls.get(url) ?? 0) + 1;
        secureCalls.set(url, count);
        if (count === 1) {
          return jsonResponse(
            { code: 401, message: 'expired', data: null },
            { status: 401 },
          );
        }
        retryTokens[url] = new Headers(init?.headers).get('Authorization');
        return jsonResponse({ code: 0, message: 'ok', data: { ok: true } });
      },
    );

    const requestA = apiClient<{ ok: boolean }>('/secure-a');
    await vi.waitFor(() => expect(refreshTokens).toEqual(['refresh-a']));

    setSession({ accessToken: 'access-b', refreshToken: 'refresh-b' });
    const requestB = apiClient<{ ok: boolean }>('/secure-b');
    await vi.waitFor(() =>
      expect(secureCalls.get('/api/v1/secure-b')).toBe(1),
    );

    refreshA.resolve(
      jsonResponse({
        code: 0,
        message: 'ok',
        data: {
          accessToken: 'access-a-next',
          refreshToken: 'refresh-a-next',
        },
      }),
    );

    const [resultA, resultB] = await Promise.allSettled([
      requestA,
      requestB,
    ]);
    expect(resultA.status).toBe('rejected');
    expect(resultB).toEqual({
      status: 'fulfilled',
      value: { ok: true },
    });
    expect(refreshTokens).toEqual(['refresh-a', 'refresh-b']);
    expect(retryTokens['/api/v1/secure-b']).toBe('Bearer access-b-next');
    expect(getSession()).toEqual({
      accessToken: 'access-b-next',
      refreshToken: 'refresh-b-next',
    });
  });

  it('clears the session when refresh fails', async () => {
    setSession({ accessToken: 'old-access', refreshToken: 'refresh-token' });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ code: 401, message: 'expired', data: null }, { status: 401 }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ code: 403, message: 'forbidden', data: null }, { status: 403 }),
      );

    await expect(apiClient('/secure')).rejects.toBeInstanceOf(ApiError);
    expect(getSession()).toBeNull();
  });

  it('wraps non-json error responses in ApiError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      }),
    );

    await expect(apiClient('/broken')).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
      message: 'Internal Server Error',
    });
  });
});
