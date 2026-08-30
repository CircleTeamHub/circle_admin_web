import { apiClient } from "./client";

export type RechargeRequestKind =
  | "GENERAL"
  | "COIN"
  | "MEMBERSHIP";
export type RechargeOrderStatus =
  | "AWAITING_PROOF"
  | "WAITING_REVIEW"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED";
export type RechargeFulfillmentType = "COIN" | "MEMBERSHIP";

export interface SupportRechargePaymentCode {
  id: string;
  label: string;
  objectKey: string;
  validFrom: string;
  validUntil: string | null;
  enabled: boolean;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportRechargeOrder {
  id: string;
  orderNo: string;
  conversationID: string;
  userID: string;
  agentUserID: string;
  requestKind: RechargeRequestKind;
  status: RechargeOrderStatus;
  evidenceMessageID: string | null;
  evidenceUrl: string | null;
  submittedAt: string | null;
  fulfillmentType: RechargeFulfillmentType | null;
  fulfillmentPayload:
    | (Omit<ApproveSupportRechargeOrderPayload, "note"> & {
        note: string | null;
      })
    | null;
  paymentTransactionID: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: string; accountId: string; nickname: string } | null;
  agent: { id: string; accountId: string; nickname: string } | null;
}

interface PresignUploadResult {
  uploadUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
}

export function listSupportRechargePaymentCodes() {
  return apiClient<SupportRechargePaymentCode[]>(
    "/admin/support/recharge/payment-codes",
  );
}

export async function uploadSupportRechargeImage(file: File): Promise<string> {
  const presign = await apiClient<PresignUploadResult>("/upload/presign", {
    method: "POST",
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      folder: "chat",
    }),
  });
  const response = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.requiredHeaders,
    body: file,
  });
  if (!response.ok) {
    throw new Error("收款码图片上传失败");
  }
  return presign.key;
}

export function createSupportRechargePaymentCode(payload: {
  label: string;
  objectKey: string;
  validFrom: string;
  validUntil: string | null;
}) {
  return apiClient<SupportRechargePaymentCode>(
    "/admin/support/recharge/payment-codes",
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function updateSupportRechargePaymentCode(
  id: string,
  payload: {
    label?: string;
    objectKey?: string;
    validFrom?: string;
    validUntil?: string | null;
  },
) {
  return apiClient<SupportRechargePaymentCode>(
    `/admin/support/recharge/payment-codes/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}

export function setSupportRechargePaymentCodeEnabled(
  id: string,
  enabled: boolean,
) {
  return apiClient<SupportRechargePaymentCode>(
    `/admin/support/recharge/payment-codes/${encodeURIComponent(id)}/enabled`,
    { method: "PATCH", body: JSON.stringify({ enabled }) },
  );
}

export function listSupportRechargeOrders(
  status: RechargeOrderStatus = "WAITING_REVIEW",
  limit = 50,
) {
  const query = new URLSearchParams({ status, limit: String(limit) });
  return apiClient<SupportRechargeOrder[]>(
    `/admin/support/recharge/orders?${query}`,
  );
}

export interface ApproveSupportRechargeOrderPayload {
  fulfillmentType: RechargeFulfillmentType;
  paymentTransactionId: string;
  coinAmount?: number;
  membershipLevel?: number;
  note?: string;
}

export function approveSupportRechargeOrder(
  id: string,
  payload: ApproveSupportRechargeOrderPayload,
) {
  return apiClient<SupportRechargeOrder>(
    `/admin/support/recharge/orders/${encodeURIComponent(id)}/approve`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export function rejectSupportRechargeOrder(id: string, reason: string) {
  return apiClient<SupportRechargeOrder>(
    `/admin/support/recharge/orders/${encodeURIComponent(id)}/reject`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
}
