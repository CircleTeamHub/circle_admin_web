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
});
