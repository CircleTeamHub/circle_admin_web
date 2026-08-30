import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  approveSupportRechargeOrder,
  listSupportRechargeOrders,
  rejectSupportRechargeOrder,
  setSupportRechargePaymentCodeEnabled,
  updateSupportRechargePaymentCode,
} from "./support-recharge";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("support recharge admin API", () => {
  beforeEach(() => mockedApiClient.mockReset());

  it("encodes order and payment-code identifiers", async () => {
    await setSupportRechargePaymentCodeEnabled("code/1", false);
    await updateSupportRechargePaymentCode("code/1", {
      objectKey: "chat/admin/new.png",
    });
    await rejectSupportRechargeOrder("order/1", "未查到交易");

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      "/admin/support/recharge/payment-codes/code%2F1/enabled",
      { method: "PATCH", body: JSON.stringify({ enabled: false }) },
    );
    expect(mockedApiClient).toHaveBeenNthCalledWith(
      2,
      "/admin/support/recharge/payment-codes/code%2F1",
      {
        method: "PATCH",
        body: JSON.stringify({ objectKey: "chat/admin/new.png" }),
      },
    );
    expect(mockedApiClient).toHaveBeenNthCalledWith(
      3,
      "/admin/support/recharge/orders/order%2F1/reject",
      { method: "POST", body: JSON.stringify({ reason: "未查到交易" }) },
    );
  });

  it("passes explicit status filters and idempotency inputs", async () => {
    await listSupportRechargeOrders("PROCESSING", 20);
    await approveSupportRechargeOrder("order-1", {
      fulfillmentType: "COIN",
      paymentTransactionId: "trade-1",
      coinAmount: 100,
    });

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      "/admin/support/recharge/orders?status=PROCESSING&limit=20",
    );
    expect(mockedApiClient).toHaveBeenNthCalledWith(
      2,
      "/admin/support/recharge/orders/order-1/approve",
      {
        method: "POST",
        body: JSON.stringify({
          fulfillmentType: "COIN",
          paymentTransactionId: "trade-1",
          coinAmount: 100,
        }),
      },
    );
  });
});
