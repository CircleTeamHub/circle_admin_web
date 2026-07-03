import { apiClient } from "./client";
import type { AuthUser } from "../types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function login(payload: LoginPayload): Promise<AuthTokens> {
  return apiClient<AuthTokens>("/auth/admin/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export function getMe(): Promise<AuthUser> {
  return apiClient<AuthUser>("/auth/me");
}
