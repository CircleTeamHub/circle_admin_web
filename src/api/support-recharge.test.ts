import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  approveSupportRechargeOrder,
  listSupportRechargeOrders,
  rejectSupportRechargeOrder,
  setSupportRechargePaymentCodeEnabled,
  updateSupportRechargePaymentCode,
  uploadSupportRechargeImage,
} from "./support-recharge";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("support recharge admin API", () => {
  beforeEach(() => mockedApiClient.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it("uses a backend-safe filename for localized image uploads", async () => {
    mockedApiClient.mockResolvedValue({
      uploadUrl: "https://upload.example.test/object",
      key: "chat/admin/code.png",
      requiredHeaders: { "content-type": "image/png" },
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["image"], "微信收款码 (1).png", {
      type: "image/png",
    });
    await expect(uploadSupportRechargeImage(file)).resolves.toBe(
      "chat/admin/code.png",
    );

    expect(mockedApiClient).toHaveBeenCalledWith("/upload/presign", {
      method: "POST",
      body: JSON.stringify({
        filename: "support-recharge.png",
        contentType: "image/png",
        sizeBytes: file.size,
        folder: "chat",
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.example.test/object",
      {
        method: "PUT",
        headers: { "content-type": "image/png" },
        body: file,
      },
    );
  });

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
    await listSupportRechargeOrders("PROCESSING", 20, "order-cursor");
    await approveSupportRechargeOrder("order-1", {
      fulfillmentType: "COIN",
      paymentTransactionId: "trade-1",
      coinAmount: 100,
    });

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      "/admin/support/recharge/orders?status=PROCESSING&limit=20&cursor=order-cursor",
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
