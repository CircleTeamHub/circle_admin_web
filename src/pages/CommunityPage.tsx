import {
  ExclamationCircleOutlined,
  MessageOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import {
  disableCircle,
  listAdminCircles,
  listAdminGroups,
  requestGroupOperation,
  restoreCircle,
  type AdminCircle,
  type AdminGroupOperationType,
  type AdminOpenimGroup,
  type CircleAdminState,
} from "../api/community";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";

type PendingAction =
  | ({
      kind: "circle";
      target: AdminCircle;
      action: "disable" | "restore";
      expectedConfirmation: string;
    } & { idempotencyKey: string })
  | ({
      kind: "group";
      target: AdminOpenimGroup;
      action: AdminGroupOperationType;
      expectedConfirmation: string;
    } & { idempotencyKey: string });

type PendingActionDraft =
  | Omit<Extract<PendingAction, { kind: "circle" }>, "idempotencyKey">
  | Omit<Extract<PendingAction, { kind: "group" }>, "idempotencyKey">;

const CIRCLE_STATE: Record<
  CircleAdminState,
  { label: string; color: string }
> = {
  ACTIVE: { label: "正常", color: "green" },
  DISABLING: { label: "停用同步中", color: "processing" },
  DISABLED: { label: "已停用/禁言", color: "orange" },
  RESTORING: { label: "恢复同步中", color: "processing" },
  SYNC_FAILED: { label: "OpenIM 同步失败", color: "red" },
  DISMISSED: { label: "群聊已永久解散", color: "red" },
};

function operationLabel(type: AdminGroupOperationType) {
  return type === "MUTE"
    ? "全员禁言"
    : type === "UNMUTE"
      ? "解除禁言"
      : "永久解散";
}

export function CommunityPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("circles");
  const [circlePage, setCirclePage] = useState(1);
  const [circleSearch, setCircleSearch] = useState("");
  const [circleStatus, setCircleStatus] = useState<
    CircleAdminState | undefined
  >();
  const [groupPage, setGroupPage] = useState(1);
  const [groupSearch, setGroupSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const circles = useQuery({
    queryKey: [
      "adminCommunity",
      "circles",
      circlePage,
      circleSearch,
      circleStatus,
    ],
    queryFn: () =>
      listAdminCircles({
        page: circlePage,
        limit: 20,
        search: circleSearch,
        status: circleStatus,
      }),
    refetchInterval: 10_000,
  });
  const groups = useQuery({
    queryKey: ["adminCommunity", "groups", groupPage, groupSearch],
    queryFn: () =>
      listAdminGroups({ page: groupPage, limit: 20, search: groupSearch }),
    enabled: activeTab === "groups",
    refetchInterval: activeTab === "groups" ? 10_000 : false,
  });

  const operation = useMutation({
    mutationFn: async (action: PendingAction) => {
      if (action.kind === "circle") {
        const fn = action.action === "disable" ? disableCircle : restoreCircle;
        return fn(
          action.target.id,
          reason.trim(),
          confirmation.trim(),
          action.idempotencyKey,
        );
      }
      return requestGroupOperation(
        action.target.groupId,
        action.action,
        reason.trim(),
        confirmation.trim(),
        action.idempotencyKey,
      );
    },
    onSuccess: (_result, action) => {
      message.success(
        action.kind === "circle" && !action.target.groupID
          ? "圈子状态已更新"
          : "管理操作已提交，正在同步 OpenIM",
      );
      setPendingAction(null);
      setReason("");
      setConfirmation("");
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "提交管理操作失败"));
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["adminCommunity"] }),
  });

  const openAction = (action: PendingActionDraft) => {
    setReason("");
    setConfirmation("");
    setPendingAction({ ...action, idempotencyKey: crypto.randomUUID() });
  };

  const circleColumns: ColumnsType<AdminCircle> = [
    {
      title: "圈子 / 关联群",
      render: (_, circle) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{circle.name}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {circle.id}
          </Typography.Text>
          <Typography.Text type="secondary">
            {circle.groupID || "未关联 OpenIM 群"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "创建者",
      render: (_, circle) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text>
            {circle.owner.nickname || circle.owner.accountId}
          </Typography.Text>
          <Typography.Text type="secondary">
            {circle.owner.accountId}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "成员", dataIndex: "memberCount", width: 90 },
    { title: "动态", dataIndex: "postCount", width: 90 },
    {
      title: "状态",
      width: 150,
      render: (_, circle) => {
        const state = CIRCLE_STATE[circle.adminState];
        return (
          <Space orientation="vertical" size={2}>
            <Tag color={state.color}>{state.label}</Tag>
            {circle.latestOperation?.status === "FAILED" ? (
              <Typography.Text type="danger">
                {circle.latestOperation.lastError || "同步失败"}
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "操作",
      width: 150,
      render: (_, circle) => {
        const busy = ["DISABLING", "RESTORING"].includes(circle.adminState);
        if (circle.adminState === "DISMISSED") {
          return (
            <Button danger disabled>
              不可恢复
            </Button>
          );
        }
        const canRestore =
          circle.deleted &&
          ["DISABLED", "SYNC_FAILED"].includes(circle.adminState) &&
          Boolean(
            circle.adminDisabledAt &&
              circle.adminDisabledBy &&
              circle.adminDisableReason,
          );
        if (circle.deleted && !canRestore && !busy) {
          return <Button disabled>不可恢复</Button>;
        }
        return circle.deleted ? (
          <Button
            icon={<UndoOutlined />}
            aria-label={`恢复 ${circle.name}`}
            disabled={busy}
            onClick={() =>
              openAction({
                kind: "circle",
                target: circle,
                action: "restore",
                expectedConfirmation: circle.name,
              })
            }
          >
            恢复
          </Button>
        ) : (
          <Button
            danger
            icon={<StopOutlined />}
            aria-label={`停用 ${circle.name}`}
            disabled={busy}
            onClick={() =>
              openAction({
                kind: "circle",
                target: circle,
                action: "disable",
                expectedConfirmation: circle.name,
              })
            }
          >
            停用
          </Button>
        );
      },
    },
  ];

  const groupColumns: ColumnsType<AdminOpenimGroup> = [
    {
      title: "群聊",
      render: (_, group) => (
        <Space orientation="vertical" size={0}>
          <Typography.Text strong>{group.name || "未命名群聊"}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {group.groupId}
          </Typography.Text>
          {group.linkedCircle ? (
            <Tag color="purple">圈子群：{group.linkedCircle.name}</Tag>
          ) : (
            <Tag>普通群</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "群主",
      render: (_, group) => group.ownerName || group.ownerUserId || "未知",
    },
    { title: "成员", dataIndex: "memberCount", width: 90 },
    {
      title: "状态",
      width: 150,
      render: (_, group) => (
        <Space orientation="vertical" size={2}>
          <Tag color={group.muted ? "orange" : "green"}>
            {group.muted ? "全员禁言" : "正常"}
          </Tag>
          {group.pendingOperation &&
          ["PENDING", "PROCESSING"].includes(group.pendingOperation.status) ? (
            <Tag color="processing">
              {operationLabel(group.pendingOperation.type)}处理中
            </Tag>
          ) : null}
          {group.pendingOperation?.status === "FAILED" ? (
            <Typography.Text type="danger">
              {group.pendingOperation.lastError || "操作失败"}
            </Typography.Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: "操作",
      width: 240,
      render: (_, group) => {
        const busy =
          group.pendingOperation &&
          ["PENDING", "PROCESSING"].includes(group.pendingOperation.status);
        const muteAction: AdminGroupOperationType = group.muted
          ? "UNMUTE"
          : "MUTE";
        return (
          <Space>
            <Button
              disabled={Boolean(busy)}
              aria-label={`${operationLabel(muteAction)} ${group.name}`}
              onClick={() =>
                openAction({
                  kind: "group",
                  target: group,
                  action: muteAction,
                  expectedConfirmation: group.groupId,
                })
              }
            >
              {operationLabel(muteAction)}
            </Button>
            <Button
              danger
              disabled={Boolean(busy)}
              aria-label={`解散 ${group.name}`}
              onClick={() =>
                openAction({
                  kind: "group",
                  target: group,
                  action: "DISMISS",
                  expectedConfirmation: group.groupId,
                })
              }
            >
              解散
            </Button>
          </Space>
        );
      },
    },
  ];

  const modalTitle = pendingAction
    ? pendingAction.kind === "circle"
      ? pendingAction.action === "disable"
        ? "停用圈子"
        : "恢复圈子"
      : operationLabel(pendingAction.action)
    : "";
  const destructive =
    pendingAction?.kind === "group" && pendingAction.action === "DISMISS";
  const canSubmit =
    reason.trim().length >= 2 &&
    confirmation.trim() === pendingAction?.expectedConfirmation;

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <div>
        <Typography.Title level={3}>圈子与群聊管理</Typography.Title>
        <Typography.Text type="secondary">
          圈子可停用恢复；群聊支持全员禁言和永久解散
        </Typography.Text>
      </div>

      <Alert
        type="warning"
        showIcon
        title="解散群聊不可恢复。所有操作都需要填写原因、输入确认文字，并记录管理员审计日志。"
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "circles",
            label: "圈子管理",
            children: (
              <Space orientation="vertical" size={12} className="page-stack">
                <Space wrap>
                  <Input.Search
                    allowClear
                    placeholder="搜索圈子名、ID、群 ID 或创建者"
                    onSearch={(value) => {
                      setCircleSearch(value.trim());
                      setCirclePage(1);
                    }}
                  />
                  <Select
                    allowClear
                    placeholder="全部状态"
                    style={{ width: 180 }}
                    value={circleStatus}
                    onChange={(value) => {
                      setCircleStatus(value);
                      setCirclePage(1);
                    }}
                    options={Object.entries(CIRCLE_STATE).map(
                      ([value, state]) => ({
                        value,
                        label: state.label,
                      }),
                    )}
                  />
                </Space>
                {circles.isError ? (
                  <PageError
                    error={circles.error}
                    onRetry={() => circles.refetch()}
                    message="圈子列表加载失败"
                  />
                ) : null}
                <Table
                  rowKey="id"
                  columns={circleColumns}
                  dataSource={circles.data?.items ?? []}
                  loading={circles.isLoading}
                  pagination={{
                    current: circlePage,
                    pageSize: 20,
                    total: circles.data?.total ?? 0,
                    showSizeChanger: false,
                    onChange: setCirclePage,
                  }}
                />
              </Space>
            ),
          },
          {
            key: "groups",
            label: "全部群聊",
            children: (
              <Space orientation="vertical" size={12} className="page-stack">
                <Input.Search
                  allowClear
                  placeholder="搜索群名称或群 ID"
                  onSearch={(value) => {
                    setGroupSearch(value.trim());
                    setGroupPage(1);
                  }}
                />
                {groups.isError ? (
                  <PageError
                    error={groups.error}
                    onRetry={() => groups.refetch()}
                    message="OpenIM 群聊列表加载失败"
                  />
                ) : null}
                <Table
                  rowKey="groupId"
                  columns={groupColumns}
                  dataSource={groups.data?.items ?? []}
                  loading={groups.isLoading}
                  pagination={{
                    current: groupPage,
                    pageSize: 20,
                    total: groups.data?.total ?? 0,
                    showSizeChanger: false,
                    onChange: setGroupPage,
                  }}
                />
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={
          <Space>
            {destructive ? <ExclamationCircleOutlined /> : <MessageOutlined />}
            {modalTitle}
          </Space>
        }
        open={Boolean(pendingAction)}
        okText="确认提交"
        okButtonProps={{ danger: destructive, disabled: !canSubmit }}
        confirmLoading={operation.isPending}
        onOk={() => pendingAction && operation.mutate(pendingAction)}
        onCancel={() => {
          if (!operation.isPending) setPendingAction(null);
        }}
      >
        <Space orientation="vertical" size={12} className="page-stack">
          {destructive ? (
            <Alert type="error" showIcon title="群聊解散后无法恢复" />
          ) : null}
          <div>
            <Typography.Text>操作原因</Typography.Text>
            <Input.TextArea
              aria-label="操作原因"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div>
            <Typography.Text>
              请输入{" "}
              <Typography.Text code>
                {pendingAction?.expectedConfirmation}
              </Typography.Text>{" "}
              确认
            </Typography.Text>
            <Input
              aria-label="确认文字"
              maxLength={128}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
