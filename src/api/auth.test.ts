import { afterEach, describe, expect, it, vi } from 'vitest';
import { login } from './auth';

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
      login({ email: 'admin@example.com', password: 'password1' }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/admin/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@example.com',
          password: 'password1',
        }),
      }),
    );
  });
});
