import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUserAvatarFrames,
  listAvatarFrameAssets,
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

describe("UserAvatarFramesCard", () => {
  beforeEach(() => {
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
    mockedInventory.mockResolvedValue({
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
              type: "MEMBERSHIP",
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
    });
  });

  it("shows the effective selection and read-only ownership source", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <UserAvatarFramesCard userId="user-1" />
      </QueryClientProvider>,
    );

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
});
