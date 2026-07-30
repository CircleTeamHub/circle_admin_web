export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const SESSION_KEY = "circle_admin_session";
const SESSION_CHANGED_EVENT = "circle-admin-session-changed";
let sessionEpoch = 0;

function notifySessionChanged(): void {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

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
  sessionEpoch += 1;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
  notifySessionChanged();
}

export function setSessionIfCurrent(
  expectedEpoch: number,
  tokens: SessionTokens,
): boolean {
  if (sessionEpoch !== expectedEpoch) return false;
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens));
  notifySessionChanged();
  return true;
}

export function clearSession(): void {
  sessionEpoch += 1;
  window.sessionStorage.removeItem(SESSION_KEY);
  notifySessionChanged();
}

export function getSessionEpoch(): number {
  return sessionEpoch;
}

export function subscribeSession(listener: () => void): () => void {
  window.addEventListener(SESSION_CHANGED_EVENT, listener);
  return () => window.removeEventListener(SESSION_CHANGED_EVENT, listener);
}
