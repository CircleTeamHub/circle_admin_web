import { apiClient } from "./client";
import type { OutboxHealth } from "../types";

export function getOutboxHealth(): Promise<OutboxHealth> {
  return apiClient<OutboxHealth>("/outbox/health");
}
