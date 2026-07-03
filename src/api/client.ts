import { clearSession, getSession, setSession } from "../auth/session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
}

interface ApiClientOptions extends RequestInit {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api/v1";

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function isEnvelope<T>(payload: unknown): payload is ApiEnvelope<T> {
  return !!payload && typeof payload === "object" && "data" in payload;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: string }).message)
        : typeof payload === "string" && payload.trim()
          ? payload
        : response.statusText;
    throw new ApiError(message, response.status, payload);
  }

  if (
    payload &&
    typeof payload === "object" &&
    "code" in payload &&
    Number((payload as ApiEnvelope<T>).code) !== 0
  ) {
    throw new ApiError(
      String((payload as ApiEnvelope<T>).message || "Request failed"),
      response.status,
      payload,
    );
  }

  return isEnvelope<T>(payload) ? (payload.data as T) : (payload as T);
}

async function refreshAccessToken(): Promise<string> {
  const session = getSession();
  if (!session?.refreshToken) {
    throw new ApiError("Missing refresh token", 401);
  }

  const data = await apiClient<{ accessToken: string; refreshToken: string }>(
    "/auth/admin/refresh",
    {
      method: "POST",
      auth: false,
      retryOnUnauthorized: false,
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    },
  );
  setSession(data);
  return data.accessToken;
}

export async function apiClient<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { auth = true, retryOnUnauthorized = true, headers, ...requestInit } = options;
  const session = getSession();
  const requestHeaders: Record<string, string> = {};
  new Headers(headers).forEach((value, key) => {
    requestHeaders[key] = value;
  });

  if (!requestHeaders["Content-Type"] && !requestHeaders["content-type"] && requestInit.body) {
    requestHeaders["Content-Type"] = "application/json";
  }
  if (auth && session?.accessToken) {
    requestHeaders.Authorization = `Bearer ${session.accessToken}`;
  }

  const response = await fetch(apiUrl(path), {
    ...requestInit,
    headers: requestHeaders,
  });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    try {
      const accessToken = await refreshAccessToken();
      requestHeaders.Authorization = `Bearer ${accessToken}`;
      return parseResponse<T>(
        await fetch(apiUrl(path), {
          ...requestInit,
          headers: requestHeaders,
        }),
      );
    } catch (error) {
      clearSession();
      throw error;
    }
  }

  return parseResponse<T>(response);
}
