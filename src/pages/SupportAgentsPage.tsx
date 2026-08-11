import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import {
  listSupportAgents,
  replaceSupportAgents,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  type SupportAgent,
  type SupportAgentInput,
  type SupportCategory,
} from "../api/support-agents";
import { listUsers } from "../api/users";
import { ApiError } from "../api/client";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";
import type { AdminUserListItem } from "../types";

const QUERY_KEY = ["supportAgents"] as const;

// ---------------------------------------------------------------------------
// 纯函数:所有编辑都返回新数组,不就地修改。导出供单测直接验证,
// 免得这些顺序/去重规则只能靠点界面来验。
// ---------------------------------------------------------------------------

export function agentsOf(
  agents: SupportAgent[],
  category: SupportCategory,
): SupportAgent[] {
  return agents.filter((agent) => agent.category === category);
}

export function addAgent(
  agents: SupportAgent[],
  category: SupportCategory,
  user: Pick<AdminUserListItem, "id" | "nickname" | "avatarUrl">,
): SupportAgent[] {
  // 同一类里不重复挂同一个人 —— 后端也有 (category,userID) 唯一约束,
  // 这里先拦一道,免得保存时才报错。
  if (agents.some((a) => a.category === category && a.userID === user.id)) {
    return agents;
  }
  return [
    ...agents,
    {
      category,
      userID: user.id,
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      vipLevel: 0,
      sortOrder: agentsOf(agents, category).length,
      enabled: true,
    },
  ];
}

export function removeAgent(
  agents: SupportAgent[],
  category: SupportCategory,
  userID: string,
): SupportAgent[] {
  return agents.filter(
    (agent) => !(agent.category === category && agent.userID === userID),
  );
}

export function setAgentEnabled(
  agents: SupportAgent[],
  category: SupportCategory,
  userID: string,
  enabled: boolean,
): SupportAgent[] {
  return agents.map((agent) =>
    agent.category === category && agent.userID === userID
      ? { ...agent, enabled }
      : agent,
  );
}

/** 在所属类内上移/下移一位;到边界则原样返回。 */
export function moveAgent(
  agents: SupportAgent[],
  category: SupportCategory,
  userID: string,
  direction: -1 | 1,
): SupportAgent[] {
  const group = agentsOf(agents, category);
  const from = group.findIndex((agent) => agent.userID === userID);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= group.length) return agents;

  const reordered = [...group];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved);

  const others = agents.filter((agent) => agent.category !== category);
  return [...others, ...reordered];
}

/** 按各类内的当前顺序重新编号 —— 界面上的位置就是 sortOrder 的唯一事实来源。 */
export function toPayload(agents: SupportAgent[]): SupportAgentInput[] {
  return SUPPORT_CATEGORIES.flatMap((category) =>
    agentsOf(agents, category).map((agent, index) => ({
      category,
      userID: agent.userID,
      sortOrder: index,
      enabled: agent.enabled,
    })),
  );
}

export function hasChanges(
  original: SupportAgent[],
  draft: SupportAgent[],
): boolean {
  return (
    JSON.stringify(toPayload(original)) !== JSON.stringify(toPayload(draft))
  );
}

/**
 * 搜索框的空态文案。失败和「查无此人」必须分开 —— 前者是接口挂了、可以重试，
 * 后者是这个人确实不存在；混成一句话会让管理员照着错误的结论行动。
 */
export function searchStatusText(
  search: { isError: boolean; isFetching: boolean },
  keyword: string,
): string | null {
  if (!keyword.trim()) return null;
  if (search.isFetching) return "搜索中…";
  if (search.isError) return "搜索失败";
  return "无匹配用户";
}

// ---------------------------------------------------------------------------

function AddAgentModal({
  open,
  category,
  onCancel,
  onPick,
}: {
  open: boolean;
  category: SupportCategory | null;
  onCancel: () => void;
  onPick: (user: AdminUserListItem) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setKeyword("");
      setSelected(null);
    }
  }, [open]);

  const search = useQuery({
    queryKey: ["supportAgentUserSearch", keyword],
    queryFn: () => listUsers({ keyword, status: "ACTIVE", page: 1, limit: 20 }),
    enabled: open && keyword.trim().length > 0,
  });

  const options = (search.data?.items ?? []).map((user) => ({
    value: user.id,
    label: `${user.nickname} (${user.accountId})`,
    user,
  }));

  return (
    <Modal
      open={open}
      title={
        category ? `添加${SUPPORT_CATEGORY_LABELS[category]}` : "添加客服"
      }
      okText="添加"
      cancelText="取消"
      okButtonProps={{ disabled: !selected }}
      onCancel={onCancel}
      onOk={() => {
        const picked = options.find((option) => option.value === selected);
        if (picked) onPick(picked.user);
      }}
    >
      <Space direction="vertical" style={{ width: "100%" }}>
        <Typography.Text type="secondary">
          按昵称或账号搜索。只列出状态正常的账号 —— 被封禁或注销的账号保存时会被后端拒绝。
        </Typography.Text>
        <Select
          showSearch
          style={{ width: "100%" }}
          placeholder="输入昵称或账号搜索"
          filterOption={false}
          // 改关键词必须清掉已选:否则 selected 还指着上一次结果里的人,而 options
          // 已经换成新查询的了 —— 「添加」按钮看着可点,onOk 里 find 不到就静默什么
          // 也不做,管理员只会觉得这个按钮坏了。
          onSearch={(value: string) => {
            setKeyword(value);
            setSelected(null);
          }}
          onChange={(value: string) => setSelected(value)}
          value={selected ?? undefined}
          loading={search.isFetching}
          options={options}
          notFoundContent={searchStatusText(search, keyword)}
        />
        {search.isError ? (
          // 搜索失败必须说是失败:报成「无匹配用户」会让管理员以为这个人不存在,
          // 从而放弃添加,而真正的原因是接口挂了。
          <Alert
            type="error"
            showIcon
            message="用户搜索失败"
            description={getErrorMessage(search.error)}
            action={
              <Button size="small" onClick={() => void search.refetch()}>
                重试
              </Button>
            }
          />
        ) : null}
      </Space>
    </Modal>
  );
}

export function SupportAgentsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SupportAgent[] | null>(null);
  const [baseRevision, setBaseRevision] = useState<string | null>(null);
  const [adding, setAdding] = useState<SupportCategory | null>(null);

  const query = useQuery({ queryKey: QUERY_KEY, queryFn: listSupportAgents });

  const original = useMemo(() => query.data?.agents ?? [], [query.data]);
  // 只在「还没有草稿」时用服务端数据初始化。原来是无条件覆盖:断网重连触发一次
  // 后台 refetch,管理员手里没保存的改动就被静默清空、连脏标记也一起没了 ——
  // 既没按保存也没按放弃。有草稿时保留草稿,冲突交给保存时的版本校验去发现。
  useEffect(() => {
    if (!query.data) return;
    setDraft((current) => {
      if (current !== null) return current;
      // 草稿所基于的版本,和草稿本身同时确定。
      setBaseRevision(query.data.revision);
      return query.data.agents;
    });
  }, [query.data]);

  const agents = draft ?? original;
  const dirty = hasChanges(original, agents);

  const save = useMutation({
    mutationFn: () => replaceSupportAgents(toPayload(agents), baseRevision ?? ""),
    onSuccess: (result) => {
      queryClient.setQueryData(QUERY_KEY, result);
      setDraft(result.agents);
      setBaseRevision(result.revision);
      void message.success("客服配置已保存");
    },
    onError: (error) => {
      // 409 = 这份草稿基于的版本已经不是最新的：别人在此期间存过。整表覆盖若照常
      // 提交，对方的改动会被无声抹掉，所以这里拉回最新配置并让管理员重做。
      if (error instanceof ApiError && error.status === 409) {
        setDraft(null);
        setBaseRevision(null);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        void message.warning(
          "客服配置已被其他管理员修改，已为你载入最新配置，请重新调整后保存",
        );
        return;
      }
      void message.error(getErrorMessage(error));
    },
  });

  // PUT 是整表覆盖:首屏 GET 还没回来时 original 是空数组,此时加一个人就会 dirty,
  // 保存下去等于「只提交这一行 + 删掉尚未加载出来的全部配置」。所以初始加载成功
  // 之前一律不可编辑、不可保存。
  const loaded = query.isSuccess && draft !== null;
  // 保存进行中也锁住:onSuccess 会用「提交那一刻的快照」覆盖 draft,
  // 期间的新编辑会被无声吃掉。
  const editable = loaded && !save.isPending;

  // 未保存的草稿在刷新/关页时给出确认。侧栏跳转拦不住:本应用用的是
  // <BrowserRouter>(非 data router),useBlocker 在这里会抛错,而为这一个页面
  // 把整个应用迁到 createBrowserRouter 不成比例。
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  if (query.isError) {
    return <PageError error={query.error} onRetry={() => void query.refetch()} />;
  }

  const columns = (category: SupportCategory): ColumnsType<SupportAgent> => [
    {
      title: "客服",
      dataIndex: "nickname",
      render: (_, agent) => (
        <Space>
          <Typography.Text>{agent.nickname}</Typography.Text>
          {!agent.enabled ? <Tag>已停用</Tag> : null}
        </Space>
      ),
    },
    {
      title: "用户 ID",
      dataIndex: "userID",
      render: (userID: string) => (
        <Typography.Text copyable type="secondary">
          {userID}
        </Typography.Text>
      ),
    },
    {
      title: "启用",
      dataIndex: "enabled",
      width: 96,
      render: (enabled: boolean, agent) => (
        <Switch
          checked={enabled}
          disabled={!editable}
          onChange={(next) =>
            setDraft(setAgentEnabled(agents, category, agent.userID, next))
          }
        />
      ),
    },
    {
      title: "顺序",
      width: 132,
      render: (_, agent, index) => (
        <Space>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            aria-label={`上移 ${agent.nickname}`}
            disabled={!editable || index === 0}
            onClick={() => setDraft(moveAgent(agents, category, agent.userID, -1))}
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            aria-label={`下移 ${agent.nickname}`}
            disabled={
              !editable || index === agentsOf(agents, category).length - 1
            }
            onClick={() => setDraft(moveAgent(agents, category, agent.userID, 1))}
          />
        </Space>
      ),
    },
    {
      title: "操作",
      width: 88,
      render: (_, agent) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={`移除 ${agent.nickname}`}
          disabled={!editable}
          onClick={() => setDraft(removeAgent(agents, category, agent.userID))}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="客服账号在这里维护，App 运行时拉取"
        description="保存即对所有客户端生效，不需要重新发版。某一类没有启用的客服时，App 对应入口显示空态——不会回落到任何默认账号。"
      />

      {SUPPORT_CATEGORIES.map((category) => {
        const group = agentsOf(agents, category);
        return (
          <Card
            key={category}
            title={SUPPORT_CATEGORY_LABELS[category]}
            extra={
              <Button
                icon={<PlusOutlined />}
                disabled={!editable}
                onClick={() => setAdding(category)}
              >
                添加客服
              </Button>
            }
          >
            {group.length === 0 ? (
              <Empty
                description={`暂无${SUPPORT_CATEGORY_LABELS[category]}，App 中该入口显示空态`}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                rowKey="userID"
                size="small"
                pagination={false}
                loading={query.isLoading}
                dataSource={group}
                columns={columns(category)}
              />
            )}
          </Card>
        );
      })}

      <Space>
        <Button
          type="primary"
          loading={save.isPending}
          disabled={!editable || !dirty}
          onClick={() => save.mutate()}
        >
          保存
        </Button>
        <Button
          disabled={!editable || !dirty}
          onClick={() => {
            setDraft(original);
            setBaseRevision(query.data?.revision ?? null);
          }}
        >
          放弃修改
        </Button>
        {dirty ? (
          <Typography.Text type="warning">有未保存的修改</Typography.Text>
        ) : null}
      </Space>

      <AddAgentModal
        open={adding !== null}
        category={adding}
        onCancel={() => setAdding(null)}
        onPick={(user) => {
          if (adding) setDraft(addAgent(agents, adding, user));
          setAdding(null);
        }}
      />
    </Space>
  );
}
