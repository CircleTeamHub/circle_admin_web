import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealSensitiveField } from "../api/users";
import { SensitiveFieldValue } from "./SensitiveFieldValue";

vi.mock("../api/users", () => ({ revealSensitiveField: vi.fn() }));

const mockedReveal = vi.mocked(revealSensitiveField);

describe("SensitiveFieldValue", () => {
  beforeEach(() => {
    mockedReveal.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the masked value by default and requires a reason", async () => {
    render(
      <SensitiveFieldValue
        userId="u1"
        field="email"
        label="邮箱"
        maskedValue="j***@example.com"
      />,
    );

    expect(screen.getByText("j***@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.click(screen.getByRole("button", { name: "确认查看" }));

    expect(await screen.findByText("请输入 3 到 500 个字符的查看原因")).toBeInTheDocument();
    expect(mockedReveal).not.toHaveBeenCalled();
  });

  it("reveals in memory and automatically remasks at expiry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    mockedReveal.mockResolvedValue({
      field: "email",
      value: "jim@example.com",
      revealedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 60_000).toISOString(),
    });
    render(
      <SensitiveFieldValue
        userId="u1"
        field="email"
        label="邮箱"
        maskedValue="j***@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.change(screen.getByLabelText("查看原因"), {
      target: { value: "CS-1024" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认查看" }));

    expect(await screen.findByText("jim@example.com")).toBeInTheDocument();
    expect(mockedReveal).toHaveBeenCalledWith("u1", {
      field: "email",
      reason: "CS-1024",
    });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("j***@example.com")).toBeInTheDocument();
    expect(screen.queryByText("jim@example.com")).not.toBeInTheDocument();
  });

  it("remasks immediately when the target user changes", async () => {
    mockedReveal.mockResolvedValue({
      field: "email",
      value: "jim@example.com",
      revealedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const view = render(
      <SensitiveFieldValue
        userId="u1"
        field="email"
        label="邮箱"
        maskedValue="j***@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.change(screen.getByLabelText("查看原因"), {
      target: { value: "CS-1024" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认查看" }));
    expect(await screen.findByText("jim@example.com")).toBeInTheDocument();

    view.rerender(
      <SensitiveFieldValue
        userId="u2"
        field="email"
        label="邮箱"
        maskedValue="a***@example.com"
      />,
    );

    expect(screen.queryByText("jim@example.com")).not.toBeInTheDocument();
    expect(screen.getByText("a***@example.com")).toBeInTheDocument();
  });

  it("drops a pending reveal dialog when the target user changes", async () => {
    const view = render(
      <SensitiveFieldValue
        userId="u1"
        field="email"
        label="邮箱"
        maskedValue="j***@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.change(screen.getByLabelText("查看原因"), {
      target: { value: "CS-1024" },
    });

    view.rerender(
      <SensitiveFieldValue
        userId="u2"
        field="email"
        label="邮箱"
        maskedValue="a***@example.com"
      />,
    );

    await waitFor(() =>
      expect(screen.queryByLabelText("查看原因")).not.toBeInTheDocument(),
    );
    expect(mockedReveal).not.toHaveBeenCalled();
  });

  it("clears the expiry timer when unmounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    mockedReveal.mockResolvedValue({
      field: "email",
      value: "jim@example.com",
      revealedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const view = render(
      <SensitiveFieldValue
        userId="u1"
        field="email"
        label="邮箱"
        maskedValue="j***@example.com"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.change(screen.getByLabelText("查看原因"), {
      target: { value: "CS-1024" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认查看" }));
    await waitFor(() => expect(mockedReveal).toHaveBeenCalled());

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
