import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, logout } from './auth';
import { clearSession, setSession } from '../auth/session';

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('auth api', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    clearSession();
  });

  it('logs in through the admin-only auth endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        code: 0,
        message: 'ok',
        data: { accessToken: 'access-token', refreshToken: 'refresh-token' },
      }),
    );
    globalThis.fetch = fetchMock;

    await expect(
      login({ identifier: 'support_01', password: 'password1' }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/admin/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          identifier: 'support_01',
          password: 'password1',
        }),
      }),
    );
  });

  it('revokes only the supplied refresh token without bearer auth or refresh replay', async () => {
    setSession({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    globalThis.fetch = fetchMock;

    await expect(logout('refresh-token')).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: 'refresh-token' }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('accepts an empty successful logout response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock;

    await logout('refresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
