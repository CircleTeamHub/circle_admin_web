import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSupportAgents, replaceSupportAgents } from "../api/support-agents";
import type { SupportAgent, SupportAgentList } from "../api/support-agents";
import { SupportAgentsPage } from "./SupportAgentsPage";

vi.mock("../api/support-agents", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../api/support-agents")>();
  return {
    ...original,
    listSupportAgents: vi.fn(),
    replaceSupportAgents: vi.fn(),
  };
});
vi.mock("../api/users", () => ({ listUsers: vi.fn() }));

const mockedList = vi.mocked(listSupportAgents);
const mockedReplace = vi.mocked(replaceSupportAgents);

const agent: SupportAgent = {
  category: "recharge",
  userID: "u1",
  nickname: "客服小王",
  avatarUrl: null,
  vipLevel: 0,
  sortOrder: 0,
  enabled: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SupportAgentsPage />
    </QueryClientProvider>,
  );
}

const addButtons = () => screen.getAllByRole("button", { name: /添加客服/ });
// antd 会在两个汉字之间插入空格,可访问名是「保 存」而不是「保存」。
const saveButton = () => screen.getByRole("button", { name: /保\s*存/ });

describe("SupportAgentsPage write guards", () => {
  beforeEach(() => {
    mockedList.mockReset();
    mockedReplace.mockReset();
  });

  // PUT 是整表覆盖。首屏 GET 还没回来时 original 是空数组,若此时允许编辑,
  // 加一个人就能保存出「只有这一行」的表 —— 把尚未加载出来的配置全删了。
  it("keeps every write control disabled until the initial load succeeds", async () => {
    const gate = deferred<SupportAgentList>();
    mockedList.mockReturnValue(gate.promise);

    renderPage();

    for (const button of addButtons()) {
      expect(button).toBeDisabled();
    }
    expect(saveButton()).toBeDisabled();

    gate.resolve({ agents: [agent] });

    await waitFor(() => expect(addButtons()[0]).toBeEnabled());
    // 加载完但没改动 —— 保存仍然不可点。
    expect(saveButton()).toBeDisabled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  // 保存进行中 onSuccess 会用「提交那一刻的快照」覆盖 draft,
  // 期间放行新编辑就会把它们无声吃掉。
  it("locks editing while a save is in flight", async () => {
    mockedList.mockResolvedValue({ agents: [agent] });
    const save = deferred<SupportAgentList>();
    mockedReplace.mockReturnValue(save.promise);

    renderPage();
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());

    // 造一个改动让保存可点：停用这一行。
    screen.getByRole("switch").click();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    saveButton().click();

    await waitFor(() => {
      for (const button of addButtons()) expect(button).toBeDisabled();
    });
    expect(
      screen.getByRole("button", { name: `移除 ${agent.nickname}` }),
    ).toBeDisabled();

    save.resolve({ agents: [{ ...agent, enabled: false }] });
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());
  });
});
