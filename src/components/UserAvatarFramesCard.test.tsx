import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  return render(
    <QueryClientProvider client={client}>
      <UserAvatarFramesCard userId="user-1" />
    </QueryClientProvider>,
  );
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
    expect(
      screen.getByRole("button", { name: "发放头像框" }),
    ).toBeEnabled();
    expect(mockedInventory).toHaveBeenCalledWith("user-1", {
      cursor: undefined,
      limit: 50,
    });
  });

  it("does not dismiss a grant dialog while the write is pending", async () => {
    const pending =
      deferred<Awaited<ReturnType<typeof grantAvatarFrame>>>();
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
        items: [
          grantRecord,
        ],
        limit: 50,
        hasMore: false,
        nextCursor: null,
      },
    });
    const pending =
      deferred<Awaited<ReturnType<typeof revokeAvatarFrameGrant>>>();
    mockedRevoke.mockReturnValue(pending.promise);
    renderCard();

    fireEvent.click(
      await screen.findByRole("button", { name: /撤\s*销/ }),
    );
    fireEvent.change(screen.getByLabelText("撤销原因"), {
      target: { value: "授权错误" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认撤销" }));

    await waitFor(() => expect(mockedRevoke).toHaveBeenCalledTimes(1));
    const cancel = screen.getByRole("button", { name: /取\s*消/ });
    fireEvent.click(cancel);

    expect(cancel).toBeDisabled();
    expect(screen.getByText("撤销 钻石头像框 授权")).toBeInTheDocument();
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
});
