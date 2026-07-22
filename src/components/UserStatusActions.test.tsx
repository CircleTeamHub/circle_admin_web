import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateUserStatus } from "../api/users";
import type { AuthUser, UserStatus } from "../types";
import {
  allowedUserStatusTargets,
  UserStatusActions,
} from "./UserStatusActions";

vi.mock("../api/users", () => ({ updateUserStatus: vi.fn() }));

const mockedUpdateStatus = vi.mocked(updateUserStatus);
const admin: AuthUser = {
  id: "admin-1",
  userId: "admin-1",
  accountId: "support-admin",
  role: "ADMIN",
  status: "ACTIVE",
};

function renderActions(
  status: UserStatus,
  options: { userId?: string; accountId?: string } = {},
) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <UserStatusActions
        userId={options.userId || "u1"}
        accountId={options.accountId || "jim-1001"}
        status={status}
        currentUser={admin}
      />
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}

describe("UserStatusActions", () => {
  beforeEach(() => {
    mockedUpdateStatus.mockReset();
    mockedUpdateStatus.mockResolvedValue({
      id: "u1",
      accountId: "jim-1001",
      status: "BANNED",
    });
  });

  it("encodes the approved permanent status transition matrix", () => {
    expect(allowedUserStatusTargets("ACTIVE")).toEqual(["BANNED", "DELETED"]);
    expect(allowedUserStatusTargets("BANNED")).toEqual(["ACTIVE", "DELETED"]);
    expect(allowedUserStatusTargets("DELETED")).toEqual([]);
  });

  it("renders only actions valid for the current status", () => {
    const active = renderActions("ACTIVE");
    expect(screen.getByRole("button", { name: "封禁" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "解封" })).not.toBeInTheDocument();
    active.invalidateSpy.mockRestore();
  });

  it("makes a deleted account read-only", () => {
    renderActions("DELETED");
    expect(screen.getByText("已删除账号不可恢复")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "封禁" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "解封" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除" })).not.toBeInTheDocument();
  });

  it("disables self ban and delete as defense in depth", () => {
    renderActions("ACTIVE", { userId: "admin-1", accountId: "support-admin" });
    expect(screen.getByRole("button", { name: "封禁" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "删除" })).toBeDisabled();
  });

  it("requires a reason for every transition", async () => {
    renderActions("BANNED");
    fireEvent.click(screen.getByRole("button", { name: "解封" }));
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));

    expect(await screen.findByText("请输入 3 到 500 个字符的操作原因")).toBeInTheDocument();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();
  });

  it("requires exact account confirmation for deletion and sends the full payload", async () => {
    const { invalidateSpy } = renderActions("ACTIVE");
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    fireEvent.change(screen.getByLabelText("操作原因"), {
      target: { value: "policy violation" },
    });
    fireEvent.change(screen.getByLabelText("确认账号 ID"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));
    expect(await screen.findByText("请输入目标用户的完整账号 ID：jim-1001")).toBeInTheDocument();
    expect(mockedUpdateStatus).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("确认账号 ID"), {
      target: { value: "jim-1001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认操作" }));

    await waitFor(() =>
      expect(mockedUpdateStatus).toHaveBeenCalledWith("u1", {
        status: "DELETED",
        reason: "policy violation",
        confirmationAccountId: "jim-1001",
      }),
    );
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["admin-users"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["admin-user", "u1"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["admin-user-audit", "u1"],
      });
    });
  });
});
