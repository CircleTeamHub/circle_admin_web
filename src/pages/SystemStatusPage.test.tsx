import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMe } from "../api/auth";
import { SystemStatusPage } from "./SystemStatusPage";

vi.mock("../api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../api/auth")>();
  return { ...original, getMe: vi.fn() };
});

const mockedGetMe = vi.mocked(getMe);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SystemStatusPage />
    </QueryClientProvider>,
  );
}

describe("SystemStatusPage", () => {
  beforeEach(() => {
    mockedGetMe.mockReset();
  });

  it("reports API reachability without the retired outbox queue panels", async () => {
    mockedGetMe.mockResolvedValue({} as Awaited<ReturnType<typeof getMe>>);

    renderPage();

    expect(await screen.findByText("可达")).toBeInTheDocument();
    expect(screen.queryByText("Outbox")).not.toBeInTheDocument();
    expect(screen.queryByText("friend outbox")).not.toBeInTheDocument();
    expect(screen.queryByText("group outbox")).not.toBeInTheDocument();
  });

  it("marks the API unreachable when the probe fails", async () => {
    mockedGetMe.mockRejectedValue(new Error("network unavailable"));

    renderPage();

    expect(await screen.findByText("不可达")).toBeInTheDocument();
  });
});
