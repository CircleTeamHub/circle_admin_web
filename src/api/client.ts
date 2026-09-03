import {
  clearSession,
  getSession,
  getSessionEpoch,
  setSessionIfCurrent,
} from "../auth/session";
import { reportApiFailure } from "../observability/sentry";

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
let refreshInFlight: {
  sessionEpoch: number;
  promise: Promise<string>;
} | null = null;

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

function sessionChangedError(): ApiError {
  return new ApiError("登录状态已变更，请重试", 401);
}

async function refreshAccessToken(sessionEpoch: number): Promise<string> {
  if (getSessionEpoch() !== sessionEpoch) throw sessionChangedError();
  const session = getSession();
  if (!session?.refreshToken) {
    throw new ApiError("登录已失效，请重新登录", 401);
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
  if (!setSessionIfCurrent(sessionEpoch, data)) {
    throw sessionChangedError();
  }
  return data.accessToken;
}

function getRefreshedAccessToken(sessionEpoch: number): Promise<string> {
  if (refreshInFlight?.sessionEpoch === sessionEpoch) {
    return refreshInFlight.promise;
  }

  const promise = refreshAccessToken(sessionEpoch).finally(() => {
    if (refreshInFlight?.promise === promise) {
      refreshInFlight = null;
    }
  });
  refreshInFlight = { sessionEpoch, promise };
  return promise;
}

/**
 * 统一出口：请求失败先经 reportApiFailure（网络不可达 / 5xx 进 Sentry，
 * 预期内的 4xx 不进），再原样抛给调用方 —— 上报绝不改变错误本身。
 */
export async function apiClient<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  try {
    return await performRequest<T>(path, options);
  } catch (error) {
    reportApiFailure(error, { path, method: options.method ?? "GET" });
    throw error;
  }
}

async function performRequest<T>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const { auth = true, retryOnUnauthorized = true, headers, ...requestInit } = options;
  const session = getSession();
  const sessionEpoch = getSessionEpoch();
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
    if (getSessionEpoch() !== sessionEpoch) {
      throw sessionChangedError();
    }
    try {
      const latestSession = getSession();
      const accessToken =
        latestSession?.accessToken &&
        latestSession.accessToken !== session?.accessToken
          ? latestSession.accessToken
          : await getRefreshedAccessToken(sessionEpoch);
      if (getSessionEpoch() !== sessionEpoch) {
        throw sessionChangedError();
      }
      requestHeaders.Authorization = `Bearer ${accessToken}`;
      return parseResponse<T>(
        await fetch(apiUrl(path), {
          ...requestInit,
          headers: requestHeaders,
        }),
      );
    } catch (error) {
      if (getSessionEpoch() === sessionEpoch) {
        clearSession();
      }
      throw error;
    }
  }

  return parseResponse<T>(response);
}
