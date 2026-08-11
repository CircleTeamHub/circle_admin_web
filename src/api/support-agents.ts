import { apiClient } from "./client";

export const SUPPORT_CATEGORIES = [
  "recharge",
  "issue",
  "dispute",
  "account",
  "membership",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  recharge: "充值客服",
  issue: "问题反馈",
  dispute: "纠纷处理",
  account: "账号客服",
  membership: "会员客服",
};

export interface SupportAgent {
  category: SupportCategory;
  userID: string;
  nickname: string;
  avatarUrl: string | null;
  vipLevel: number;
  sortOrder: number;
  enabled: boolean;
}

export interface SupportAgentList {
  agents: SupportAgent[];
}

/** 含停用行 —— App 的 /support/config 只返回启用的，管理台要能把停用的改回来。 */
export function listSupportAgents(): Promise<SupportAgentList> {
  return apiClient<SupportAgentList>("/admin/support/agents");
}

export interface SupportAgentInput {
  category: SupportCategory;
  userID: string;
  sortOrder: number;
  enabled: boolean;
}

/**
 * 整表覆盖写入。
 *
 * 停用要传 enabled=false，而不是从数组里省略 —— 省略等于删除。
 * sortOrder 由调用方按各类内的当前顺序重新编号后传入。
 */
export function replaceSupportAgents(
  agents: SupportAgentInput[],
): Promise<SupportAgentList> {
  return apiClient<SupportAgentList>("/admin/support/agents", {
    method: "PUT",
    body: JSON.stringify({ agents }),
  });
}
