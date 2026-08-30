import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveSupportRechargeOrder,
  createSupportRechargePaymentCode,
  listSupportRechargeOrders,
  listSupportRechargePaymentCodes,
  rejectSupportRechargeOrder,
  setSupportRechargePaymentCodeEnabled,
  updateSupportRechargePaymentCode,
  uploadSupportRechargeImage,
  type SupportRechargeOrder,
  type SupportRechargePaymentCode,
} from "../api/support-recharge";
import { SupportRechargePage } from "./SupportRechargePage";

vi.mock("../api/support-recharge", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../api/support-recharge")>();
  return {
    ...original,
    approveSupportRechargeOrder: vi.fn(),
    createSupportRechargePaymentCode: vi.fn(),
    listSupportRechargeOrders: vi.fn(),
    listSupportRechargePaymentCodes: vi.fn(),
    rejectSupportRechargeOrder: vi.fn(),
    setSupportRechargePaymentCodeEnabled: vi.fn(),
    updateSupportRechargePaymentCode: vi.fn(),
    uploadSupportRechargeImage: vi.fn(),
  };
});

const mockedApprove = vi.mocked(approveSupportRechargeOrder);
const mockedCreateCode = vi.mocked(createSupportRechargePaymentCode);
const mockedListOrders = vi.mocked(listSupportRechargeOrders);
const mockedListCodes = vi.mocked(listSupportRechargePaymentCodes);
const mockedReject = vi.mocked(rejectSupportRechargeOrder);
const mockedToggleCode = vi.mocked(setSupportRechargePaymentCodeEnabled);
const mockedUpdateCode = vi.mocked(updateSupportRechargePaymentCode);
const mockedUpload = vi.mocked(uploadSupportRechargeImage);

function paymentCode(
  id: string,
  enabled: boolean,
): SupportRechargePaymentCode {
  return {
    id,
    label: `收款码 ${id}`,
    objectKey: `chat/${id}.png`,
    validFrom: "2026-08-29T09:00:00.000Z",
    validUntil: null,
    enabled,
    previewUrl: null,
    createdAt: "2026-08-29T09:00:00.000Z",
    updatedAt: "2026-08-29T09:00:00.000Z",
  };
}

function order(
  id: string,
  overrides: Partial<SupportRechargeOrder> = {},
): SupportRechargeOrder {
  return {
    id,
    orderNo: `RC-${id}`,
    conversationID: `conversation-${id}`,
    userID: `user-${id}`,
    agentUserID: "agent-1",
    requestKind: "COIN",
    status: "WAITING_REVIEW",
    evidenceMessageID: `message-${id}`,
    evidenceUrl: null,
    submittedAt: "2026-08-29T10:00:00.000Z",
    fulfillmentType: null,
    fulfillmentPayload: null,
    paymentTransactionID: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    createdAt: "2026-08-29T09:00:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
    user: {
      id: `user-${id}`,
      accountId: `account-${id}`,
      nickname: `用户${id}`,
    },
    agent: null,
    ...overrides,
  };
}

function renderPage(orders: SupportRechargeOrder[]) {
  mockedListOrders.mockResolvedValue(orders);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <SupportRechargePage />
    </QueryClientProvider>,
  );
}

function rowFor(orderNo: string) {
  const row = screen.getByText(orderNo).closest("tr");
  if (!row) throw new Error(`Missing row for ${orderNo}`);
  return within(row);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe("SupportRechargePage review safety", () => {
  beforeEach(() => {
    mockedApprove.mockReset();
    mockedCreateCode.mockReset();
    mockedListOrders.mockReset();
    mockedListCodes.mockReset();
    mockedReject.mockReset();
    mockedToggleCode.mockReset();
    mockedUpdateCode.mockReset();
    mockedUpload.mockReset();
    mockedListCodes.mockResolvedValue([]);
    mockedApprove.mockResolvedValue(order("approved", { status: "APPROVED" }));
    mockedCreateCode.mockResolvedValue(paymentCode("created", true));
    mockedReject.mockResolvedValue(order("rejected", { status: "REJECTED" }));
    mockedUpdateCode.mockResolvedValue(paymentCode("updated", true));
    mockedUpload.mockResolvedValue("chat/uploaded.png");
  });

  it("does not carry an approval draft into another order", async () => {
    renderPage([order("A"), order("B")]);
    await screen.findByText("RC-A");

    fireEvent.click(
      await rowFor("RC-A").findByRole("button", { name: /核对并发放/ }),
    );
    fireEvent.change(screen.getByLabelText("支付平台交易号"), {
      target: { value: "trade-A" },
    });
    fireEvent.change(await screen.findByLabelText("积分数量"), {
      target: { value: "100" },
    });
    fireEvent.change(screen.getByLabelText("审核备注（可选）"), {
      target: { value: "order A note" },
    });
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    fireEvent.click(rowFor("RC-B").getByRole("button", { name: /核对并发放/ }));

    expect(screen.getByLabelText("支付平台交易号")).toHaveValue("");
    expect(screen.getByLabelText("积分数量")).toHaveValue("");
    expect(screen.getByLabelText("审核备注（可选）")).toHaveValue("");
  });

  it("resets rejection drafts and enforces backend input limits", async () => {
    renderPage([order("A"), order("B")]);
    await screen.findByText("RC-A");

    fireEvent.click(
      await rowFor("RC-A").findByRole("button", { name: /驳回/ }),
    );
    const reason = screen.getByLabelText("告知用户的原因");
    expect(reason).toHaveAttribute("maxlength", "300");
    fireEvent.change(reason, { target: { value: "A 的驳回原因" } });
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    fireEvent.click(rowFor("RC-B").getByRole("button", { name: /驳回/ }));
    expect(screen.getByLabelText("告知用户的原因")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));

    fireEvent.click(rowFor("RC-A").getByRole("button", { name: /核对并发放/ }));
    expect(await screen.findByLabelText("积分数量")).toHaveAttribute(
      "aria-valuemax",
      "1000000",
    );
  });

  it("keeps the active approval modal locked while fulfillment is pending", async () => {
    const pending = deferred<SupportRechargeOrder>();
    mockedApprove.mockReturnValue(pending.promise);
    renderPage([order("A")]);
    await screen.findByText("RC-A");

    fireEvent.click(
      await rowFor("RC-A").findByRole("button", { name: /核对并发放/ }),
    );
    fireEvent.change(screen.getByLabelText("支付平台交易号"), {
      target: { value: "trade-A" },
    });
    fireEvent.change(await screen.findByLabelText("积分数量"), {
      target: { value: "100" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "确认付款并发放" }),
    );

    await waitFor(() => expect(mockedApprove).toHaveBeenCalledTimes(1));
    expect(mockedApprove).toHaveBeenCalledWith("A", {
      fulfillmentType: "COIN",
      paymentTransactionId: "trade-A",
      coinAmount: 100,
      note: undefined,
    });
    expect(screen.getByRole("button", { name: /取\s*消/ })).toBeDisabled();

    await act(async () => {
      pending.resolve(order("A", { status: "APPROVED" }));
    });
    await waitFor(() =>
      expect(
        screen.getByText("核对并发放 · RC-A"),
      ).not.toBeVisible(),
    );
  });

  it("submits the saved membership payload when resuming fulfillment", async () => {
    renderPage([
      order("processing", {
        requestKind: "MEMBERSHIP",
        status: "PROCESSING",
        fulfillmentType: "MEMBERSHIP",
        fulfillmentPayload: {
          fulfillmentType: "MEMBERSHIP",
          paymentTransactionId: "trade-membership",
          membershipLevel: 3,
          note: "已核对",
        },
      }),
    ]);
    await screen.findByText("RC-processing");

    fireEvent.click(
      rowFor("RC-processing").getByRole("button", { name: /继续发放/ }),
    );
    expect(await screen.findByLabelText("会员等级")).toHaveValue("3");
    fireEvent.click(screen.getByRole("button", { name: "确认付款并发放" }));

    await waitFor(() =>
      expect(mockedApprove).toHaveBeenCalledWith("processing", {
        fulfillmentType: "MEMBERSHIP",
        paymentTransactionId: "trade-membership",
        membershipLevel: 3,
        note: "已核对",
      }),
    );
  });

  it("trims the user-facing rejection reason before submitting", async () => {
    renderPage([order("A")]);
    await screen.findByText("RC-A");

    fireEvent.click(rowFor("RC-A").getByRole("button", { name: /驳回/ }));
    fireEvent.change(screen.getByLabelText("告知用户的原因"), {
      target: { value: "  支付平台未查到交易  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认驳回" }));

    await waitFor(() =>
      expect(mockedReject).toHaveBeenCalledWith("A", "支付平台未查到交易"),
    );
  });

  it("keeps every payment-code switch disabled while one update is pending", async () => {
    const pending = deferred<SupportRechargePaymentCode>();
    mockedToggleCode.mockReturnValue(pending.promise);
    mockedListCodes.mockResolvedValue([
      paymentCode("A", true),
      paymentCode("B", false),
    ]);
    renderPage([]);
    await screen.findByText("收款码 A");

    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    await waitFor(() =>
      expect(mockedToggleCode).toHaveBeenCalledWith("A", false),
    );
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).toBeDisabled();

    await act(async () => {
      pending.resolve(paymentCode("A", false));
    });
  });

  it("uploads and creates a payment code with the exact form payload", async () => {
    renderPage([]);
    await screen.findByText("充值申请");
    fireEvent.click(screen.getByRole("button", { name: /新增收款码/ }));

    fireEvent.change(screen.getByLabelText("支付方式说明"), {
      target: { value: "  支付宝尾号 1234  " },
    });
    fireEvent.change(screen.getByLabelText("生效时间"), {
      target: { value: "2026-08-29T10:00" },
    });
    const file = new File(["image"], "收款码.png", { type: "image/png" });
    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    if (!fileInput) throw new Error("Missing payment-code file input");
    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByText("收款码.png");
    fireEvent.click(screen.getByRole("button", { name: "上传并启用" }));

    await waitFor(() =>
      expect(mockedUpload).toHaveBeenCalledWith(
        expect.objectContaining({ name: "收款码.png", type: "image/png" }),
      ),
    );
    expect(mockedCreateCode).toHaveBeenCalledWith({
      label: "支付宝尾号 1234",
      objectKey: "chat/uploaded.png",
      validFrom: new Date("2026-08-29T10:00").toISOString(),
      validUntil: null,
    });
  });

  it("updates payment-code metadata without replacing its image", async () => {
    mockedListCodes.mockResolvedValue([paymentCode("A", true)]);
    renderPage([]);
    await screen.findByText("收款码 A");
    fireEvent.click(screen.getByRole("button", { name: /编辑\/换图/ }));

    fireEvent.change(screen.getByLabelText("支付方式说明"), {
      target: { value: "  新说明  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(mockedUpdateCode).toHaveBeenCalledWith("A", {
        label: "新说明",
        validFrom: "2026-08-29T09:00:00.000Z",
        validUntil: null,
      }),
    );
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it("uploads a replacement image when editing a payment code", async () => {
    mockedListCodes.mockResolvedValue([paymentCode("A", true)]);
    renderPage([]);
    await screen.findByText("收款码 A");
    fireEvent.click(screen.getByRole("button", { name: /编辑\/换图/ }));

    const replacement = new File(["replacement"], "新收款码.webp", {
      type: "image/webp",
    });
    const fileInput = document.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );
    if (!fileInput) throw new Error("Missing payment-code file input");
    fireEvent.change(fileInput, { target: { files: [replacement] } });
    await screen.findByText("新收款码.webp");
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() =>
      expect(mockedUpdateCode).toHaveBeenCalledWith("A", {
        label: "收款码 A",
        validFrom: "2026-08-29T09:00:00.000Z",
        validUntil: null,
        objectKey: "chat/uploaded.png",
      }),
    );
    expect(mockedUpload).toHaveBeenCalledWith(
      expect.objectContaining({ name: "新收款码.webp", type: "image/webp" }),
    );
  });

  it("keeps payment-code edits visible after a save failure", async () => {
    mockedListCodes.mockResolvedValue([paymentCode("A", true)]);
    mockedUpdateCode.mockRejectedValue(new Error("conflict"));
    renderPage([]);
    await screen.findByText("收款码 A");
    fireEvent.click(screen.getByRole("button", { name: /编辑\/换图/ }));

    fireEvent.change(screen.getByLabelText("支付方式说明"), {
      target: { value: "待重试说明" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(mockedUpdateCode).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("button", { name: "保存修改" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("支付方式说明")).toHaveValue("待重试说明");
  });

  it("shows fulfillment and rejection details for audit history", async () => {
    renderPage([
      order("approved", {
        status: "APPROVED",
        fulfillmentType: "COIN",
        fulfillmentPayload: {
          fulfillmentType: "COIN",
          paymentTransactionId: "trade-approved",
          coinAmount: 500,
          note: "线下已核对",
        },
        paymentTransactionID: "trade-approved",
        reviewedBy: "admin-1",
        reviewedAt: "2026-08-29T11:00:00.000Z",
      }),
      order("rejected", {
        status: "REJECTED",
        rejectionReason: "支付平台未查到交易",
        reviewedBy: "admin-2",
        reviewedAt: "2026-08-29T12:00:00.000Z",
      }),
      order("legacy", {
        status: "APPROVED",
        fulfillmentType: null,
        fulfillmentPayload: null,
      }),
    ]);

    expect(await screen.findByText("积分 500")).toBeInTheDocument();
    expect(screen.getByText("备注：线下已核对")).toBeInTheDocument();
    expect(screen.getByText("驳回：支付平台未查到交易")).toBeInTheDocument();
    expect(screen.getByText(/审核人：admin-1/)).toBeInTheDocument();
    expect(screen.getByText(/审核人：admin-2/)).toBeInTheDocument();
    expect(screen.getByText("发放详情未记录")).toBeInTheDocument();
  });
});
