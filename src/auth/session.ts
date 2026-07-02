export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const SESSION_KEY = "circle_admin_session";

export function getSession(): SessionTokens | null {
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as SessionTokens;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSession(tokens: SessionTokens): void {
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
}

export function clearSession(): void {
  window.sessionStorage.removeItem(SESSION_KEY);
}
