import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listSupportAgents, replaceSupportAgents } from "../api/support-agents";
import { ApiError } from "../api/client";
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
  accountId: "rechargecs01",
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

  it("shows the searchable account ID instead of the internal UUID", async () => {
    mockedList.mockResolvedValue({ agents: [agent], revision: "rev-1" });

    renderPage();

    await waitFor(() => expect(screen.getByText("rechargecs01")).toBeTruthy());
    expect(screen.getByText("账号 ID")).toBeTruthy();
    expect(screen.queryByText("u1")).toBeNull();
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

    gate.resolve({ agents: [agent], revision: "rev-1" });

    await waitFor(() => expect(addButtons()[0]).toBeEnabled());
    // 加载完但没改动 —— 保存仍然不可点。
    expect(saveButton()).toBeDisabled();
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  // 保存进行中 onSuccess 会用「提交那一刻的快照」覆盖 draft,
  // 期间放行新编辑就会把它们无声吃掉。
  it("locks editing while a save is in flight", async () => {
    mockedList.mockResolvedValue({ agents: [agent], revision: "rev-1" });
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

    save.resolve({ agents: [{ ...agent, enabled: false }], revision: "rev-2" });
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());
  });

  // 断网重连会触发一次后台 refetch。原来无条件用响应覆盖 draft，管理员手里没保存的
  // 改动会被静默清空，连脏标记也一起没了 —— 既没按保存也没按放弃。
  it("keeps unsaved edits when a background refetch returns new server data", async () => {
    mockedList.mockResolvedValue({ agents: [agent], revision: "rev-1" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <SupportAgentsPage />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());

    screen.getByRole("switch").click();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    // 服务端数据变了（别人存过），后台 refetch 拿回新内容。
    mockedList.mockResolvedValue({
      agents: [{ ...agent, sortOrder: 7 }],
      revision: "rev-9",
    });
    await client.invalidateQueries({ queryKey: ["supportAgents"] });

    // 草稿与脏标记都还在。
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  // 整表覆盖 + 旧页签 = 无声抹掉别人的改动，所以服务端用 revision 判 409。
  // 但客户端也不能顺手把本地草稿丢了 —— 那等于「按一下保存，自己的改动全没了」。
  it("keeps the draft and surfaces the conflict instead of discarding edits", async () => {
    mockedList.mockResolvedValue({ agents: [agent], revision: "rev-1" });
    mockedReplace.mockRejectedValue(new ApiError("冲突", 409));

    renderPage();
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());

    screen.getByRole("switch").click();
    await waitFor(() => expect(saveButton()).toBeEnabled());

    mockedList.mockResolvedValue({
      agents: [{ ...agent, nickname: "别人存的客服" }],
      revision: "rev-2",
    });
    saveButton().click();

    // 冲突被显式告知，而不是静默失败。
    await waitFor(() =>
      expect(screen.getByText("保存失败：配置已被其他管理员修改")).toBeTruthy(),
    );
    // 草稿还在：开关仍是我改过的那个状态，保存仍可点。
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(saveButton()).toBeEnabled();

    // 放弃是显式动作，不是副作用。
    screen.getByRole("button", { name: /放弃我的修改并载入最新/ }).click();
    await waitFor(() => expect(screen.getByText("别人存的客服")).toBeTruthy());
    await waitFor(() => expect(saveButton()).toBeDisabled());
  });

  // 本地什么都没改时，后台刷新应当采纳新数据 —— 否则屏幕上停着过期列表，
  // 却显示「有未保存的修改」，存下去还会撞一个本可避免的 409。
  it("adopts refreshed server data when there are no local edits", async () => {
    mockedList.mockResolvedValue({ agents: [agent], revision: "rev-1" });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <SupportAgentsPage />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());

    mockedList.mockResolvedValue({
      agents: [{ ...agent, nickname: "别人存的客服" }],
      revision: "rev-2",
    });
    await client.invalidateQueries({ queryKey: ["supportAgents"] });

    await waitFor(() => expect(screen.getByText("别人存的客服")).toBeTruthy());
    // 没动过就不该显示「有未保存的修改」。
    expect(saveButton()).toBeDisabled();
  });

  it("sends the revision it loaded so the server can detect staleness", async () => {
    mockedList.mockResolvedValue({ agents: [agent], revision: "rev-abc" });
    mockedReplace.mockResolvedValue({ agents: [agent], revision: "rev-def" });

    renderPage();
    await waitFor(() => expect(addButtons()[0]).toBeEnabled());

    screen.getByRole("switch").click();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    saveButton().click();

    await waitFor(() => expect(mockedReplace).toHaveBeenCalled());
    expect(mockedReplace.mock.calls[0][1]).toBe("rev-abc");
  });
});
