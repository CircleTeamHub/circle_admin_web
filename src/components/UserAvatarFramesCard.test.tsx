import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  grantAvatarFrame,
  getUserAvatarFrames,
  listAvatarFrameAssets,
  revokeAvatarFrameGrant,
} from "../api/avatar-frames";
import { UserAvatarFramesCard } from "./UserAvatarFramesCard";

vi.mock("../api/avatar-frames", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../api/avatar-frames")>();
  return {
    ...original,
    getUserAvatarFrames: vi.fn(),
    listAvatarFrameAssets: vi.fn(),
    grantAvatarFrame: vi.fn(),
    revokeAvatarFrameGrant: vi.fn(),
  };
});

const mockedInventory = vi.mocked(getUserAvatarFrames);
const mockedAssets = vi.mocked(listAvatarFrameAssets);
const mockedGrant = vi.mocked(grantAvatarFrame);
const mockedRevoke = vi.mocked(revokeAvatarFrameGrant);

const grantRecord = {
  id: "grant-1",
  userId: "user-1",
  frameId: "frame-1",
  frame: {
    id: "frame-1",
    key: "membership-diamond",
    name: "钻石头像框",
    imageUrl: null,
  },
  operatorUserId: "admin-1",
  idempotencyKey: "grant-request-1",
  status: "ACTIVE" as const,
  reason: "历史发放",
  expiresAt: null,
  revokedAt: null,
  revokedByUserId: null,
  revokeReason: null,
  createdAt: "2026-07-29T00:00:00.000Z",
  updatedAt: "2026-07-29T00:00:00.000Z",
};

const inventoryResponse = {
  userId: "user-1",
  equippedFrameId: null,
  equippedFrameExpiresAt: null,
  equippedFrame: null,
  items: [
    {
      id: "frame-1",
      key: "membership-diamond",
      name: "钻石头像框",
      description: null,
      imageUrl: null,
      minimumVipLevel: 3,
      ownedSources: [
        {
          type: "MEMBERSHIP" as const,
          minimumVipLevel: 3,
          expiresAt: "2027-01-01T00:00:00.000Z",
        },
      ],
      availableUntil: "2027-01-01T00:00:00.000Z",
      equipped: false,
    },
  ],
  grants: {
    items: [],
    limit: 50,
    hasMore: false,
    nextCursor: null,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function renderCard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <UserAvatarFramesCard userId="user-1" />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

describe("UserAvatarFramesCard", () => {
  beforeEach(() => {
    mockedInventory.mockReset();
    mockedAssets.mockReset();
    mockedGrant.mockReset();
    mockedRevoke.mockReset();
    mockedAssets.mockResolvedValue([
      {
        id: "frame-1",
        key: "membership-diamond",
        name: "钻石头像框",
        description: null,
        imageUrl: null,
        minimumVipLevel: 3,
        sortOrder: 1,
      },
    ]);
    mockedInventory.mockResolvedValue(inventoryResponse);
  });

  it("shows the effective selection and read-only ownership source", async () => {
    renderCard();

    expect(await screen.findByText("钻石头像框")).toBeInTheDocument();
    expect(screen.getByText("不展示头像框")).toBeInTheDocument();
    expect(screen.getByText("会员 Lv.3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "发放头像框" })).toBeEnabled();
    expect(mockedInventory).toHaveBeenCalledWith("user-1", {
      cursor: undefined,
      limit: 50,
    });
  });

  it("keeps the current frame unknown while the first inventory page loads", async () => {
    const pending = deferred<Awaited<ReturnType<typeof getUserAvatarFrames>>>();
    mockedInventory.mockReturnValue(pending.promise);

    renderCard();

    expect(screen.getByText("加载中…")).toBeInTheDocument();
    expect(screen.queryByText("不展示头像框")).not.toBeInTheDocument();

    pending.resolve(inventoryResponse);
    expect(await screen.findByText("不展示头像框")).toBeInTheDocument();
  });

  it("disables grants when a cached asset catalog refresh fails", async () => {
    const { client } = renderCard();
    const grantButton = await screen.findByRole("button", {
      name: "发放头像框",
    });
    await waitFor(() => expect(grantButton).toBeEnabled());

    mockedAssets.mockRejectedValueOnce(new Error("catalog unavailable"));
    await client.refetchQueries({
      queryKey: ["admin-avatar-frame-assets"],
    });

    await waitFor(() => expect(grantButton).toBeDisabled());
    expect(screen.getByText("头像框目录加载失败")).toBeInTheDocument();
  });

  it("refetches when the nearest active grant expires", async () => {
    const expiresAt = new Date(Date.now() + 30).toISOString();
    mockedInventory.mockResolvedValue({
      ...inventoryResponse,
      grants: {
        ...inventoryResponse.grants,
        items: [{ ...grantRecord, expiresAt }],
      },
    });

    renderCard();

    expect(await screen.findByText("历史发放")).toBeInTheDocument();
    await waitFor(() => expect(mockedInventory).toHaveBeenCalledTimes(2), {
      timeout: 1_000,
    });
  });

  it("refetches when membership-only ownership expires", async () => {
    const expiresAt = new Date(Date.now() + 30).toISOString();
    mockedInventory.mockResolvedValue({
      ...inventoryResponse,
      items: inventoryResponse.items.map((item) => ({
        ...item,
        availableUntil: expiresAt,
        ownedSources: item.ownedSources.map((source) => ({
          ...source,
          expiresAt,
        })),
      })),
    });

    renderCard();

    expect(await screen.findByText("会员 Lv.3")).toBeInTheDocument();
    await waitFor(() => expect(mockedInventory).toHaveBeenCalledTimes(2), {
      timeout: 1_000,
    });
  });

  it("keeps retrying when a past-looking expiry remains active", async () => {
    vi.useFakeTimers();
    const expiresAt = new Date(Date.now() - 1_000).toISOString();
    mockedInventory.mockResolvedValue({
      ...inventoryResponse,
      items: inventoryResponse.items.map((item) => ({
        ...item,
        availableUntil: expiresAt,
        ownedSources: item.ownedSources.map((source) => ({
          ...source,
          expiresAt,
        })),
      })),
    });

    const view = renderCard();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText("会员 Lv.3")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });
      expect(mockedInventory).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(mockedInventory).toHaveBeenCalledTimes(3);
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it("reschedules capped timers until a distant expiry is reached", async () => {
    vi.useFakeTimers();
    const maxTimerDelay = 2_147_483_647;
    const expiresAt = new Date(
      Date.now() + maxTimerDelay + 100_000,
    ).toISOString();
    mockedInventory.mockResolvedValue({
      ...inventoryResponse,
      items: inventoryResponse.items.map((item) => ({
        ...item,
        availableUntil: expiresAt,
        ownedSources: item.ownedSources.map((source) => ({
          ...source,
          expiresAt,
        })),
      })),
    });

    const view = renderCard();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      expect(screen.getByText("会员 Lv.3")).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(maxTimerDelay);
      });
      expect(mockedInventory).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100_050);
      });
      expect(mockedInventory).toHaveBeenCalledTimes(3);
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it("preserves loaded inventory when loading another grant page fails", async () => {
    mockedInventory
      .mockResolvedValueOnce({
        ...inventoryResponse,
        grants: {
          ...inventoryResponse.grants,
          items: [grantRecord],
          hasMore: true,
          nextCursor: "next-page",
        },
      })
      .mockRejectedValueOnce(new Error("next page unavailable"))
      .mockResolvedValueOnce({
        ...inventoryResponse,
        grants: {
          ...inventoryResponse.grants,
          items: [],
        },
      });
    renderCard();

    expect(await screen.findByText("历史发放")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加载更多记录" }));

    expect(await screen.findByText("更多发放记录加载失败")).toBeInTheDocument();
    expect(screen.getByText("历史发放")).toBeInTheDocument();
    expect(screen.getByText("会员 Lv.3")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "发放头像框" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: /撤\s*销/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "重试加载更多" }));
    await waitFor(() => expect(mockedInventory).toHaveBeenCalledTimes(3));
    expect(mockedInventory.mock.calls[2]).toEqual([
      "user-1",
      { cursor: "next-page", limit: 50 },
    ]);
  });

  it("does not dismiss a grant dialog while the write is pending", async () => {
    const pending = deferred<Awaited<ReturnType<typeof grantAvatarFrame>>>();
    mockedGrant.mockReturnValue(pending.promise);
    renderCard();

    const grantButton = await screen.findByRole("button", {
      name: "发放头像框",
    });
    await waitFor(() => expect(grantButton).toBeEnabled());
    fireEvent.click(grantButton);
    fireEvent.mouseDown(screen.getByLabelText("选择头像框"));
    fireEvent.click(
      await screen.findByText("钻石头像框", {
        selector: ".ant-select-item-option-content",
      }),
    );
    fireEvent.change(screen.getByLabelText("发放原因"), {
      target: { value: "客服补发" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发放" }));

    await waitFor(() => expect(mockedGrant).toHaveBeenCalledTimes(1));
    const cancel = screen.getByRole("button", { name: /取\s*消/ });
    fireEvent.click(cancel);

    expect(cancel).toBeDisabled();
    expect(
      screen.getByRole("dialog", { name: "发放头像框" }),
    ).toBeInTheDocument();
  });

  it("does not dismiss a revoke dialog while the write is pending", async () => {
    mockedInventory.mockResolvedValueOnce({
      ...inventoryResponse,
      grants: {
        items: [grantRecord],
        limit: 50,
        hasMore: false,
        nextCursor: null,
      },
    });
    const pending =
      deferred<Awaited<ReturnType<typeof revokeAvatarFrameGrant>>>();
    mockedRevoke.mockReturnValue(pending.promise);
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: /撤\s*销/ }));
    fireEvent.change(screen.getByLabelText("撤销原因"), {
      target: { value: "授权错误" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => expect(mockedRevoke).toHaveBeenCalledTimes(1));
    const cancel = screen.getByRole("button", { name: /取\s*消/ });
    fireEvent.click(cancel);

    expect(cancel).toBeDisabled();
    expect(screen.getByLabelText("撤销原因")).toBeDisabled();
    expect(screen.getByText("撤销 钻石头像框 授权")).toBeInTheDocument();
  });

  it("disables an open revoke dialog after the grant expires", async () => {
    const activeInventory = {
      ...inventoryResponse,
      grants: {
        ...inventoryResponse.grants,
        items: [grantRecord],
      },
    };
    mockedInventory.mockResolvedValue(activeInventory);
    const { client } = renderCard();

    fireEvent.click(await screen.findByRole("button", { name: /撤\s*销/ }));
    fireEvent.change(screen.getByLabelText("撤销原因"), {
      target: { value: "授权错误" },
    });
    client.setQueryData(["admin-avatar-frames", "user-1"], {
      pages: [
        {
          ...activeInventory,
          grants: {
            ...activeInventory.grants,
            items: [{ ...grantRecord, status: "EXPIRED" as const }],
          },
        },
      ],
      pageParams: [undefined],
    });

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "确认撤销" }),
      ).toBeDisabled(),
    );
    expect(
      screen.getByText("该授权状态已变化，不能再撤销"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));
    expect(mockedRevoke).not.toHaveBeenCalled();
  });

  it("preserves the submitted revoke reason after an ambiguous failure", async () => {
    const activeInventory = {
      ...inventoryResponse,
      grants: {
        ...inventoryResponse.grants,
        items: [grantRecord],
      },
    };
    mockedInventory
      .mockResolvedValueOnce(activeInventory)
      .mockRejectedValueOnce(new Error("refresh unavailable"))
      .mockResolvedValue(activeInventory);
    mockedRevoke
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({
        replayed: true,
        grant: {
          ...grantRecord,
          status: "REVOKED",
          revokeReason: "第一次原因",
        },
      });
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: /撤\s*销/ }));
    fireEvent.change(screen.getByLabelText("撤销原因"), {
      target: { value: "第一次原因" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => expect(mockedRevoke).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByLabelText("撤销原因")).toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => expect(mockedRevoke).toHaveBeenCalledTimes(2));
    expect(mockedRevoke.mock.calls[0]?.[1]).toEqual({
      reason: "第一次原因",
    });
    expect(mockedRevoke.mock.calls[1]?.[1]).toEqual({
      reason: "第一次原因",
    });
  });

  it("shows a retry alert when refreshing cached inventory fails", async () => {
    mockedInventory
      .mockResolvedValueOnce({
        ...inventoryResponse,
        grants: {
          ...inventoryResponse.grants,
          items: [grantRecord],
        },
      })
      .mockRejectedValueOnce(new Error("refresh unavailable"));
    mockedRevoke.mockResolvedValue({
      replayed: false,
      grant: {
        ...grantRecord,
        status: "REVOKED",
        revokeReason: "授权错误",
      },
    });
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: /撤\s*销/ }));
    fireEvent.change(screen.getByLabelText("撤销原因"), {
      target: { value: "授权错误" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    expect(
      await screen.findByText("头像框信息刷新失败，当前显示的是缓存数据"),
    ).toBeInTheDocument();
    expect(screen.getByText("历史发放")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "重新刷新" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /撤\s*销/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "发放头像框" })).toBeDisabled();
  });

  it("revalidates a grant expiration at submit time", async () => {
    const view = renderCard();
    try {
      const grantButton = await screen.findByRole("button", {
        name: "发放头像框",
      });
      await waitFor(() => expect(grantButton).toBeEnabled());
      fireEvent.click(grantButton);
      fireEvent.mouseDown(screen.getByLabelText("选择头像框"));
      fireEvent.click(
        screen.getByText("钻石头像框", {
          selector: ".ant-select-item-option-content",
        }),
      );
      const future = new Date(Date.now() + 60_000);
      const pad = (value: number) => String(value).padStart(2, "0");
      const futureInput = `${future.getFullYear()}-${pad(
        future.getMonth() + 1,
      )}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(
        future.getMinutes(),
      )}`;
      fireEvent.change(screen.getByLabelText("到期时间"), {
        target: { value: futureInput },
      });
      fireEvent.change(screen.getByLabelText("发放原因"), {
        target: { value: "限时授权" },
      });

      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 120_000));
      fireEvent.click(screen.getByRole("button", { name: "确认发放" }));

      expect(mockedGrant).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      vi.useRealTimers();
    }
  });

  it("clears a canceled grant draft before reopening the dialog", async () => {
    renderCard();

    const grantButton = await screen.findByRole("button", {
      name: "发放头像框",
    });
    await waitFor(() => expect(grantButton).toBeEnabled());
    fireEvent.click(grantButton);
    fireEvent.mouseDown(screen.getByLabelText("选择头像框"));
    fireEvent.click(
      await screen.findByText("钻石头像框", {
        selector: ".ant-select-item-option-content",
      }),
    );
    fireEvent.change(screen.getByLabelText("到期时间"), {
      target: { value: "2027-01-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("发放原因"), {
      target: { value: "取消的草稿" },
    });

    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
    fireEvent.click(grantButton);

    expect(screen.getByLabelText("选择头像框")).toHaveValue("");
    expect(screen.getByLabelText("到期时间")).toHaveValue("");
    expect(screen.getByLabelText("发放原因")).toHaveValue("");
  });

  it("keeps revoke actions locked until the inventory refresh completes", async () => {
    const activeInventory = {
      ...inventoryResponse,
      grants: {
        items: [grantRecord],
        limit: 50,
        hasMore: false,
        nextCursor: null,
      },
    };
    const refetch = deferred<Awaited<ReturnType<typeof getUserAvatarFrames>>>();
    mockedInventory
      .mockResolvedValueOnce(activeInventory)
      .mockReturnValueOnce(refetch.promise);
    mockedRevoke.mockResolvedValue({
      replayed: false,
      grant: {
        ...grantRecord,
        status: "REVOKED",
        revokedAt: "2026-07-30T00:00:00.000Z",
        revokedByUserId: "admin-1",
        revokeReason: "授权错误",
      },
    });
    renderCard();

    fireEvent.click(await screen.findByRole("button", { name: /撤\s*销/ }));
    fireEvent.change(screen.getByLabelText("撤销原因"), {
      target: { value: "授权错误" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => expect(mockedInventory).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: /撤\s*销/ })).toBeDisabled();

    refetch.resolve({
      ...activeInventory,
      grants: {
        ...activeInventory.grants,
        items: [
          {
            ...grantRecord,
            status: "REVOKED",
            revokedAt: "2026-07-30T00:00:00.000Z",
            revokedByUserId: "admin-1",
            revokeReason: "授权错误",
          },
        ],
      },
    });
    expect(await screen.findByText("已撤销")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /撤\s*销/ })).toBeDisabled();
  });

  it("rotates the grant key when a failed request payload is edited", async () => {
    mockedGrant
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ replayed: false, grant: grantRecord });
    renderCard();

    const grantButton = await screen.findByRole("button", {
      name: "发放头像框",
    });
    await waitFor(() => expect(grantButton).toBeEnabled());
    fireEvent.click(grantButton);
    fireEvent.mouseDown(screen.getByLabelText("选择头像框"));
    fireEvent.click(
      await screen.findByText("钻石头像框", {
        selector: ".ant-select-item-option-content",
      }),
    );
    fireEvent.change(screen.getByLabelText("发放原因"), {
      target: { value: "第一次原因" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发放" }));
    await waitFor(() => expect(mockedGrant).toHaveBeenCalledTimes(1));
    await expect(mockedGrant.mock.results[0]?.value).rejects.toThrow(
      "response lost",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("发放原因")).toBeEnabled(),
    );

    fireEvent.change(screen.getByLabelText("发放原因"), {
      target: { value: "修改后的原因" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发放" }));

    await waitFor(() => expect(mockedGrant).toHaveBeenCalledTimes(2));
    expect(mockedGrant.mock.calls[1]?.[1].idempotencyKey).not.toBe(
      mockedGrant.mock.calls[0]?.[1].idempotencyKey,
    );
  });

  it("preserves the grant key for normalization-equivalent retries", async () => {
    mockedGrant
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({ replayed: true, grant: grantRecord });
    renderCard();

    const grantButton = await screen.findByRole("button", {
      name: "发放头像框",
    });
    await waitFor(() => expect(grantButton).toBeEnabled());
    fireEvent.click(grantButton);
    fireEvent.mouseDown(screen.getByLabelText("选择头像框"));
    fireEvent.click(
      await screen.findByText("钻石头像框", {
        selector: ".ant-select-item-option-content",
      }),
    );
    fireEvent.change(screen.getByLabelText("发放原因"), {
      target: { value: "客服补发" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发放" }));
    await waitFor(() => expect(mockedGrant).toHaveBeenCalledTimes(1));
    await expect(mockedGrant.mock.results[0]?.value).rejects.toThrow(
      "response lost",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("发放原因")).toBeEnabled(),
    );

    fireEvent.change(screen.getByLabelText("发放原因"), {
      target: { value: "  客服补发  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认发放" }));

    await waitFor(() => expect(mockedGrant).toHaveBeenCalledTimes(2));
    expect(mockedGrant.mock.calls[1]?.[1].idempotencyKey).toBe(
      mockedGrant.mock.calls[0]?.[1].idempotencyKey,
    );
  });
});
