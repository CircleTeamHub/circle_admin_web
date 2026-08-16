import { describe, expect, it } from "vitest";
import {
  addAgent,
  agentsOf,
  hasChanges,
  moveAgent,
  removeAgent,
  searchStatusText,
  setAgentEnabled,
  toPayload,
} from "./SupportAgentsPage";
import type { SupportAgent } from "../api/support-agents";

const agent = (
  category: SupportAgent["category"],
  userID: string,
  overrides: Partial<SupportAgent> = {},
): SupportAgent => ({
  category,
  userID,
  accountId: `account-${userID}`,
  nickname: `nick-${userID}`,
  avatarUrl: null,
  vipLevel: 0,
  sortOrder: 0,
  enabled: true,
  ...overrides,
});

const user = (id: string) => ({
  id,
  accountId: `account-${id}`,
  nickname: `nick-${id}`,
  avatarUrl: null,
});

describe("support agent draft editing", () => {
  it("never mutates the array it is given", () => {
    const before = [agent("recharge", "u1"), agent("recharge", "u2")];
    const snapshot = JSON.parse(JSON.stringify(before));

    addAgent(before, "recharge", user("u3"));
    removeAgent(before, "recharge", "u1");
    setAgentEnabled(before, "recharge", "u1", false);
    moveAgent(before, "recharge", "u1", 1);

    expect(before).toEqual(snapshot);
  });

  it("refuses the same user twice in one category but allows it across categories", () => {
    const once = addAgent([], "recharge", user("u1"));
    expect(agentsOf(once, "recharge")).toHaveLength(1);
    expect(once[0].accountId).toBe("account-u1");

    // 后端有 (category,userID) 唯一约束;这里先拦一道,免得保存时才报错。
    expect(addAgent(once, "recharge", user("u1"))).toBe(once);

    const both = addAgent(once, "dispute", user("u1"));
    expect(agentsOf(both, "dispute")).toHaveLength(1);
    expect(agentsOf(both, "recharge")).toHaveLength(1);
  });

  it("moves within a category and stops at the boundaries", () => {
    const list = [
      agent("recharge", "a"),
      agent("recharge", "b"),
      agent("recharge", "c"),
    ];

    expect(
      agentsOf(moveAgent(list, "recharge", "c", -1), "recharge").map(
        (a) => a.userID,
      ),
    ).toEqual(["a", "c", "b"]);

    // 到边界原样返回,不该悄悄绕回另一端。
    expect(moveAgent(list, "recharge", "a", -1)).toBe(list);
    expect(moveAgent(list, "recharge", "c", 1)).toBe(list);
  });

  it("does not reorder a different category", () => {
    const list = [
      agent("recharge", "a"),
      agent("issue", "x"),
      agent("recharge", "b"),
      agent("issue", "y"),
    ];

    const moved = moveAgent(list, "recharge", "b", -1);
    expect(agentsOf(moved, "recharge").map((a) => a.userID)).toEqual(["b", "a"]);
    expect(agentsOf(moved, "issue").map((a) => a.userID)).toEqual(["x", "y"]);
  });

  it("renumbers sortOrder from the on-screen position, per category", () => {
    const list = [
      agent("recharge", "a", { sortOrder: 40 }),
      agent("issue", "x", { sortOrder: 7 }),
      agent("recharge", "b", { sortOrder: 5 }),
    ];

    expect(toPayload(list)).toEqual([
      { category: "recharge", userID: "a", sortOrder: 0, enabled: true },
      { category: "recharge", userID: "b", sortOrder: 1, enabled: true },
      { category: "issue", userID: "x", sortOrder: 0, enabled: true },
    ]);
  });

  // 停用必须留在 payload 里 —— 省略等于删除,会连带丢掉顺序与创建时间。
  it("keeps a disabled agent in the payload", () => {
    const list = setAgentEnabled(
      [agent("recharge", "u1")],
      "recharge",
      "u1",
      false,
    );

    expect(toPayload(list)).toEqual([
      { category: "recharge", userID: "u1", sortOrder: 0, enabled: false },
    ]);
  });

  it("detects edits that change the payload and ignores ones that do not", () => {
    const original = [agent("recharge", "a"), agent("recharge", "b")];

    expect(hasChanges(original, original)).toBe(false);
    // 昵称是服务端回填的展示字段,变了不算配置改动。
    expect(
      hasChanges(original, [
        agent("recharge", "a", { nickname: "renamed" }),
        agent("recharge", "b"),
      ]),
    ).toBe(false);

    expect(hasChanges(original, moveAgent(original, "recharge", "b", -1))).toBe(
      true,
    );
    expect(
      hasChanges(original, setAgentEnabled(original, "recharge", "a", false)),
    ).toBe(true);
    expect(hasChanges(original, removeAgent(original, "recharge", "a"))).toBe(
      true,
    );
  });

  // 搜索失败报成「无匹配用户」会让管理员以为这个人不存在，从而放弃添加，
  // 而真正的原因是接口挂了。
  it("tells a failed user search apart from an empty one", () => {
    expect(searchStatusText({ isError: false, isFetching: false }, "  ")).toBe(
      null,
    );
    expect(searchStatusText({ isError: false, isFetching: true }, "abc")).toBe(
      "搜索中…",
    );
    expect(searchStatusText({ isError: true, isFetching: false }, "abc")).toBe(
      "搜索失败",
    );
    expect(searchStatusText({ isError: false, isFetching: false }, "abc")).toBe(
      "无匹配用户",
    );
  });
});
