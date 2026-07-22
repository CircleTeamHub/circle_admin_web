import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revealSensitiveField } from "../api/users";
import { SensitiveFieldValue } from "./SensitiveFieldValue";

vi.mock("../api/users", () => ({ revealSensitiveField: vi.fn() }));

const mockedReveal = vi.mocked(revealSensitiveField);

interface FieldProps {
  userId: string;
  maskedValue: string;
}

function renderField(props: FieldProps) {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const ui = ({ userId, maskedValue }: FieldProps) => (
    <QueryClientProvider client={client}>
      <SensitiveFieldValue
        userId={userId}
        field="email"
        label="邮箱"
        maskedValue={maskedValue}
      />
    </QueryClientProvider>
  );
  const view = render(ui(props));
  return {
    invalidateSpy,
    unmount: () => view.unmount(),
    rerender: (next: FieldProps) => view.rerender(ui(next)),
  };
}

function serverReveal(revealedAt: number, expiresAt: number) {
  mockedReveal.mockResolvedValue({
    field: "email",
    value: "jim@example.com",
    revealedAt: new Date(revealedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

function submitReveal(reason = "CS-1024") {
  fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
  fireEvent.change(screen.getByLabelText("查看原因"), {
    target: { value: reason },
  });
  fireEvent.click(screen.getByRole("button", { name: "确认查看" }));
}

describe("SensitiveFieldValue", () => {
  beforeEach(() => {
    mockedReveal.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the masked value by default and requires a reason", async () => {
    renderField({ userId: "u1", maskedValue: "j***@example.com" });

    expect(screen.getByText("j***@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.click(screen.getByRole("button", { name: "确认查看" }));

    expect(await screen.findByText("请输入 3 到 500 个字符的查看原因")).toBeInTheDocument();
    expect(mockedReveal).not.toHaveBeenCalled();
  });

  it("reveals in memory and automatically remasks at expiry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    serverReveal(now, now + 60_000);
    renderField({ userId: "u1", maskedValue: "j***@example.com" });

    submitReveal();

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

  it("remasks on the server window when the workstation clock lags the API", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // 管理员工作站时钟比服务端慢 2 小时：拿 expiresAt 直接减本地 now
    // 会算出 2 小时的延时，明文会一直留在 DOM 里。
    const serverNow = Date.now() + 2 * 60 * 60 * 1000;
    serverReveal(serverNow, serverNow + 60_000);
    renderField({ userId: "u1", maskedValue: "j***@example.com" });

    submitReveal();
    expect(await screen.findByText("jim@example.com")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByText("jim@example.com")).not.toBeInTheDocument();
    expect(screen.getByText("j***@example.com")).toBeInTheDocument();
  });

  it("caps the reveal window at one minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const now = Date.now();
    serverReveal(now, now + 60 * 60 * 1000);
    renderField({ userId: "u1", maskedValue: "j***@example.com" });

    submitReveal();
    expect(await screen.findByText("jim@example.com")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryByText("jim@example.com")).not.toBeInTheDocument();
  });

  it("refreshes the audit history after a successful reveal", async () => {
    const now = Date.now();
    serverReveal(now, now + 60_000);
    const { invalidateSpy } = renderField({
      userId: "u1",
      maskedValue: "j***@example.com",
    });

    submitReveal();
    expect(await screen.findByText("jim@example.com")).toBeInTheDocument();

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["admin-user-audit", "u1"],
      }),
    );
  });

  it("remasks immediately when the target user changes", async () => {
    const now = Date.now();
    serverReveal(now, now + 60_000);
    const view = renderField({ userId: "u1", maskedValue: "j***@example.com" });

    submitReveal();
    expect(await screen.findByText("jim@example.com")).toBeInTheDocument();

    view.rerender({ userId: "u2", maskedValue: "a***@example.com" });

    expect(screen.queryByText("jim@example.com")).not.toBeInTheDocument();
    expect(screen.getByText("a***@example.com")).toBeInTheDocument();
  });

  it("drops a pending reveal dialog when the target user changes", async () => {
    const view = renderField({ userId: "u1", maskedValue: "j***@example.com" });

    fireEvent.click(screen.getByRole("button", { name: "查看原文" }));
    fireEvent.change(screen.getByLabelText("查看原因"), {
      target: { value: "CS-1024" },
    });

    view.rerender({ userId: "u2", maskedValue: "a***@example.com" });

    await waitFor(() =>
      expect(screen.queryByLabelText("查看原因")).not.toBeInTheDocument(),
    );
    expect(mockedReveal).not.toHaveBeenCalled();
  });

  it("clears the expiry timer when unmounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const now = Date.now();
    serverReveal(now, now + 60_000);
    const view = renderField({ userId: "u1", maskedValue: "j***@example.com" });

    submitReveal();
    await waitFor(() => expect(mockedReveal).toHaveBeenCalled());

    view.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
