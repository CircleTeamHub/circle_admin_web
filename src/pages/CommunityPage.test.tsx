import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableCircle,
  listAdminCircles,
  listAdminGroups,
  requestGroupOperation,
  restoreCircle,
} from "../api/community";
import { CommunityPage } from "./CommunityPage";

vi.mock("../api/community", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/community")>();
  return {
    ...original,
    disableCircle: vi.fn(),
    listAdminCircles: vi.fn(),
    listAdminGroups: vi.fn(),
    requestGroupOperation: vi.fn(),
    restoreCircle: vi.fn(),
  };
});

const mockedDisable = vi.mocked(disableCircle);
const mockedListCircles = vi.mocked(listAdminCircles);
const mockedListGroups = vi.mocked(listAdminGroups);
const mockedGroupOperation = vi.mocked(requestGroupOperation);
const mockedRestore = vi.mocked(restoreCircle);

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <CommunityPage />
    </QueryClientProvider>,
  );
}

describe("CommunityPage", () => {
  beforeEach(() => {
    mockedDisable.mockReset();
    mockedListCircles.mockReset();
    mockedListGroups.mockReset();
    mockedGroupOperation.mockReset();
    mockedRestore.mockReset();
    mockedListCircles.mockResolvedValue({
      items: [
        {
          id: "circle-1",
          name: "摄影圈",
          groupID: "group-1",
          memberCount: 120,
          postCount: 30,
          deleted: false,
          adminState: "ACTIVE",
          adminDisabledAt: null,
          adminDisabledBy: null,
          adminDisableReason: null,
          createdAt: "2026-07-29T00:00:00.000Z",
          owner: {
            id: "owner-1",
            accountId: "alice",
            nickname: "Alice",
          },
          latestOperation: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    mockedListGroups.mockResolvedValue({
      items: [
        {
          groupId: "group-2",
          name: "周末徒步",
          faceUrl: null,
          status: 0,
          muted: false,
          memberCount: 88,
          ownerUserId: "owner-2",
          ownerName: "Bob",
          linkedCircle: null,
          pendingOperation: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    mockedDisable.mockResolvedValue({} as never);
    mockedRestore.mockResolvedValue({} as never);
    mockedGroupOperation.mockResolvedValue({} as never);
  });

  it(
    "submits a confirmed circle disable operation",
    async () => {
      renderPage();

      fireEvent.click(
        await screen.findByRole(
          "button",
          { name: "停用 摄影圈" },
          { timeout: 10_000 },
        ),
      );
      fireEvent.change(screen.getByLabelText("操作原因"), {
        target: { value: "存在违规内容" },
      });
      fireEvent.change(screen.getByLabelText("确认文字"), {
        target: { value: "摄影圈" },
      });
      fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

      await waitFor(() =>
        expect(mockedDisable).toHaveBeenCalledWith(
          "circle-1",
          "存在违规内容",
          "摄影圈",
          expect.any(String),
        ),
      );
    },
  );

  it("reuses the idempotency key when a failed action is retried", async () => {
    mockedDisable
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({} as never);
    renderPage();

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "停用 摄影圈" },
        { timeout: 10_000 },
      ),
    );
    fireEvent.change(screen.getByLabelText("操作原因"), {
      target: { value: "存在违规内容" },
    });
    fireEvent.change(screen.getByLabelText("确认文字"), {
      target: { value: "摄影圈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

    await waitFor(() => expect(mockedDisable).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "确认提交" }),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

    await waitFor(() => expect(mockedDisable).toHaveBeenCalledTimes(2));
    expect(mockedDisable.mock.calls[1]?.[3]).toBe(
      mockedDisable.mock.calls[0]?.[3],
    );
  });

  it("rotates the idempotency key when a failed action payload is edited", async () => {
    mockedDisable
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce({} as never);
    renderPage();

    fireEvent.click(
      await screen.findByRole(
        "button",
        { name: "停用 摄影圈" },
        { timeout: 10_000 },
      ),
    );
    fireEvent.change(screen.getByLabelText("操作原因"), {
      target: { value: "第一次原因" },
    });
    fireEvent.change(screen.getByLabelText("确认文字"), {
      target: { value: "摄影圈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));
    await waitFor(() => expect(mockedDisable).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("操作原因"), {
      target: { value: "修改后的原因" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

    await waitFor(() => expect(mockedDisable).toHaveBeenCalledTimes(2));
    expect(mockedDisable.mock.calls[1]?.[3]).not.toBe(
      mockedDisable.mock.calls[0]?.[3],
    );
  });

  it("keeps row actions locked until the authoritative refetch completes", async () => {
    const refetch = deferred<Awaited<ReturnType<typeof listAdminCircles>>>();
    renderPage();

    const disable = await screen.findByRole(
      "button",
      { name: "停用 摄影圈" },
      { timeout: 10_000 },
    );
    mockedListCircles.mockReturnValueOnce(refetch.promise);
    fireEvent.click(disable);
    fireEvent.change(screen.getByLabelText("操作原因"), {
      target: { value: "存在违规内容" },
    });
    fireEvent.change(screen.getByLabelText("确认文字"), {
      target: { value: "摄影圈" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

    await waitFor(() => expect(mockedListCircles).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("button", { name: "停用 摄影圈" }),
    ).toBeDisabled();
    refetch.resolve({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "停用 摄影圈" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("allows an unlinked circle to be disabled locally", async () => {
    mockedListCircles.mockResolvedValue({
      items: [
        {
          id: "circle-1",
          name: "历史圈子",
          groupID: null,
          memberCount: 12,
          postCount: 3,
          deleted: false,
          adminState: "ACTIVE",
          adminDisabledAt: null,
          adminDisabledBy: null,
          adminDisableReason: null,
          createdAt: "2026-07-29T00:00:00.000Z",
          owner: {
            id: "owner-1",
            accountId: "alice",
            nickname: "Alice",
          },
          latestOperation: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();

    const disable = await screen.findByRole("button", {
      name: "停用 历史圈子",
    });
    expect(disable).not.toBeDisabled();
    fireEvent.click(disable);
    fireEvent.change(screen.getByLabelText("操作原因"), {
      target: { value: "历史违规内容" },
    });
    fireEvent.change(screen.getByLabelText("确认文字"), {
      target: { value: "历史圈子" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

    await waitFor(() =>
      expect(mockedDisable).toHaveBeenCalledWith(
        "circle-1",
        "历史违规内容",
        "历史圈子",
        expect.any(String),
      ),
    );
  });

  it(
    "can permanently dismiss a standalone OpenIM group",
    async () => {
      renderPage();
      fireEvent.click(await screen.findByText("全部群聊"));
      fireEvent.click(
        await screen.findByRole("button", { name: "解散 周末徒步" }),
      );
      fireEvent.change(screen.getByLabelText("操作原因"), {
        target: { value: "诈骗群聊" },
      });
      fireEvent.change(screen.getByLabelText("确认文字"), {
        target: { value: "group-2" },
      });
      fireEvent.click(screen.getByRole("button", { name: "确认提交" }));

      await waitFor(() =>
        expect(mockedGroupOperation).toHaveBeenCalledWith(
          "group-2",
          "DISMISS",
          "诈骗群聊",
          "group-2",
          expect.any(String),
        ),
      );
    },
  );

  it("does not offer restore after a linked group was permanently dismissed", async () => {
    mockedListCircles.mockResolvedValue({
      items: [
        {
          id: "circle-1",
          name: "已解散圈子",
          groupID: "group-1",
          memberCount: 120,
          postCount: 30,
          deleted: true,
          adminState: "DISMISSED",
          adminDisabledAt: "2026-07-29T00:00:00.000Z",
          adminDisabledBy: "admin-1",
          adminDisableReason: "永久关闭",
          createdAt: "2026-07-29T00:00:00.000Z",
          owner: {
            id: "owner-1",
            accountId: "alice",
            nickname: "Alice",
          },
          latestOperation: {
            id: "operation-1",
            type: "DISMISS",
            status: "SUCCEEDED",
            lastError: null,
          },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderPage();

    expect(
      await screen.findByText("群聊已永久解散"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不可恢复" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "恢复 已解散圈子" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer restore for a legacy deletion without admin provenance", async () => {
    mockedListCircles.mockResolvedValue({
      items: [
        {
          id: "circle-legacy",
          name: "历史删除圈子",
          groupID: "group-legacy",
          memberCount: 3,
          postCount: 1,
          deleted: true,
          adminState: "ACTIVE",
          adminDisabledAt: null,
          adminDisabledBy: null,
          adminDisableReason: null,
          createdAt: "2026-07-01T00:00:00.000Z",
          owner: {
            id: "owner-1",
            accountId: "alice",
            nickname: "Alice",
          },
          latestOperation: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });

    renderPage();

    expect(await screen.findByText("历史删除圈子")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "不可恢复" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "恢复 历史删除圈子" }),
    ).not.toBeInTheDocument();
  });
});
