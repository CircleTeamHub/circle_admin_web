import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import {
  grantAvatarFrame,
  listAvatarFrameAssets,
  getUserAvatarFrames,
  revokeAvatarFrameGrant,
} from "./avatar-frames";

vi.mock("./client", () => ({ apiClient: vi.fn() }));

const mockedApiClient = vi.mocked(apiClient);

describe("Admin avatar-frame API", () => {
  beforeEach(() => mockedApiClient.mockReset());

  it("loads the active catalog and a cursor page of user inventory", async () => {
    await listAvatarFrameAssets();
    await getUserAvatarFrames("user/id", { cursor: "next/cursor", limit: 25 });

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      "/admin/avatar-frames/assets",
    );
    expect(mockedApiClient).toHaveBeenNthCalledWith(
      2,
      "/admin/avatar-frames/users/user%2Fid?cursor=next%2Fcursor&limit=25",
    );
  });

  it("creates idempotent grants and revokes grants", async () => {
    await grantAvatarFrame("user-1", {
      frameId: "frame-1",
      expiresAt: null,
      reason: "CS-100",
      idempotencyKey: "key-1",
    });
    await revokeAvatarFrameGrant("grant/1", { reason: "CS-101" });

    expect(mockedApiClient).toHaveBeenNthCalledWith(
      1,
      "/admin/avatar-frames/users/user-1/grants",
      {
        method: "POST",
        body: JSON.stringify({
          frameId: "frame-1",
          expiresAt: null,
          reason: "CS-100",
          idempotencyKey: "key-1",
        }),
      },
    );
    expect(mockedApiClient).toHaveBeenNthCalledWith(
      2,
      "/admin/avatar-frames/grants/grant%2F1/revoke",
      {
        method: "POST",
        body: JSON.stringify({ reason: "CS-101" }),
      },
    );
  });
});
