import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { consoleApi, consoleWrite } from "../api/console";
import { ReleasesPage } from "./ReleasesPage";

vi.mock("../api/console", () => ({
  consoleApi: { releases: vi.fn(), preview: vi.fn() },
  consoleWrite: vi.fn(),
}));
vi.mock("../auth/admin-access", () => ({
  useAdminAccess: () => ({ hasPermission: () => true }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(consoleApi.releases).mockResolvedValue({ releases: [], plans: [] } as never);
});

// 漏填必填项只是表单校验没过:不能显示成「请求失败」,也不能发请求。
it("does not present a missing required field as a failed request", async () => {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <ReleasesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "登记已发布版本" }));
  const dialog = await screen.findByRole("dialog");
  const ok = Array.from(dialog.querySelectorAll("button")).find((button) =>
    button.classList.contains("ant-btn-primary"),
  )!;
  fireEvent.click(ok);

  await waitFor(() =>
    expect(dialog.querySelector(".ant-form-item-explain-error")).not.toBeNull(),
  );
  expect(consoleWrite).not.toHaveBeenCalled();
  expect(screen.queryByText("加载失败")).not.toBeInTheDocument();
  expect(screen.queryByText("保存失败")).not.toBeInTheDocument();
});
