import { PageHeader } from "../components/PageHeader";
import { Link } from "react-router-dom";
import {
  MessageOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import {
  disableCircle,
  listAdminCircles,
  restoreCircle,
  listAdminGroups,
  type AdminCircle,
  type CircleAdminState,
} from "../api/community";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";

type PendingAction = {
  target: AdminCircle;
  action: "disable" | "restore";
  expectedConfirmation: string;
  idempotencyKey: string;
  submittedPayload: string | null;
};
type PendingActionDraft = Omit<
  PendingAction,
  "idempotencyKey" | "submittedPayload"
>;

const CIRCLE_STATE: Record<CircleAdminState, { label: string; color: string }> =
  {
    ACTIVE: { label: "正常", color: "green" },
    DISABLING: { label: "停用同步中", color: "processing" },
    DISABLED: { label: "已停用/禁言", color: "orange" },
    RESTORING: { label: "恢复同步中", color: "processing" },
    SYNC_FAILED: { label: "OpenIM 同步失败", color: "red" },
    DISMISSED: { label: "群聊已永久解散", color: "red" },
  };

function isPendingActionStale(action: PendingAction, circles: AdminCircle[]) {
  const target = circles.find((circle) => circle.id === action.target.id);
  if (!target) return true;
  if (action.action === "disable") {
    return (
      target.deleted ||
      ["DISABLING", "RESTORING", "DISMISSED"].includes(target.adminState)
    );
  }
  return (
    !target.deleted ||
    !["DISABLED", "SYNC_FAILED"].includes(target.adminState) ||
    !target.adminDisabledAt ||
    !target.adminDisabledBy ||
    !target.adminDisableReason
  );
}

function GroupDirectory() {
 const [page,setPage]=useState(1), [search,setSearch]=useState("");
 const query=useQuery({queryKey:["community-group-directory",page,search],queryFn:()=>listAdminGroups({page,limit:20,search:search||undefined})});
 return <Card title="群聊目录"><Input.Search aria-label="搜索群聊" placeholder="搜索群聊名称或编号" onSearch={value=>{setSearch(value.trim());setPage(1);}}/>
 {query.isError ? <PageError error={query.error} onRetry={()=>{void query.refetch();}}/> : <Table rowKey="groupId" loading={query.isLoading} dataSource={query.data?.items??[]} pagination={{current:page,pageSize:20,total:query.data?.total??0,onChange:setPage}} columns={[
 {title:"群聊名称",render:(_,group)=><Link to={`/community/groups/${encodeURIComponent(group.conversationId??group.groupId)}`}>{group.name||"未命名群聊"}</Link>},
 {title:"成员数",dataIndex:"memberCount"},
 {title:"关联圈子",render:(_,group)=>group.linkedCircle?.name??"独立群聊"},
 ]}/>}</Card>;
}

export function CommunityPage() {
  const queryClient = useQueryClient();
  const [showGroups, setShowGroups] = useState(false);
  const [circlePage, setCirclePage] = useState(1);
  const [circleSearch, setCircleSearch] = useState("");
  const [circleStatus, setCircleStatus] = useState<
    CircleAdminState | undefined
  >();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
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
  const pendingActionStale = pendingAction
    ? isPendingActionStale(pendingAction, circles.data?.items ?? [])
    : false;

  const operation = useMutation({
    mutationFn: async (action: PendingAction) => {
      const fn = action.action === "disable" ? disableCircle : restoreCircle;
      return fn(
        action.target.id,
        reason.trim(),
        confirmation.trim(),
        action.idempotencyKey,
      );
    },
    onSuccess: (_result, action) => {
      message.success(
        !action.target.groupID
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
    if (operation.isPending || circles.isError) {
      return;
    }
    setReason("");
    setConfirmation("");
    setPendingAction({
      ...action,
      idempotencyKey: crypto.randomUUID(),
      submittedPayload: null,
    });
  };

  const submitPendingAction = () => {
    if (!pendingAction) return;
    if (circles.isError) {
      return;
    }
    if (pendingActionStale) return;
    const submittedPayload = JSON.stringify([
      reason.trim(),
      confirmation.trim(),
    ]);
    const action =
      pendingAction.submittedPayload === null ||
      pendingAction.submittedPayload === submittedPayload
        ? { ...pendingAction, submittedPayload }
        : {
            ...pendingAction,
            idempotencyKey: crypto.randomUUID(),
            submittedPayload,
          };
    setPendingAction(action);
    operation.mutate(action);
  };

  const circleColumns: ColumnsType<AdminCircle> = [
    {
      title: "圈子 / 关联群",
      render: (_, circle) => (
        <Space orientation="vertical" size={0}>
          <Link to={`/community/circles/${encodeURIComponent(circle.id)}`}>
            <Typography.Text strong>{circle.name}</Typography.Text>
          </Link>
          <Typography.Text type="secondary">
            {circle.associatedGroup === undefined
              ? "群聊关联待确认"
              : circle.associatedGroup
                ? `群聊：${circle.associatedGroup.name || circle.name}`
                : "尚未建立群聊"}
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
            disabled={busy || operation.isPending || circles.isError}
            onClick={() =>
              openAction({
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
            disabled={busy || operation.isPending || circles.isError}
            onClick={() =>
              openAction({
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

  const modalTitle = pendingAction
    ? pendingAction.action === "disable"
      ? "停用圈子"
      : "恢复圈子"
    : "";
  const pendingActionQueryError = Boolean(pendingAction) && circles.isError;
  const canSubmit =
    !pendingActionQueryError &&
    !pendingActionStale &&
    reason.trim().length >= 2 &&
    confirmation.trim() === pendingAction?.expectedConfirmation;

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <div>
        <PageHeader title="圈子管理" description="查看圈子资料、成员与动态，处理停用和恢复。" />
      </div>

      <Button onClick={()=>setShowGroups(value=>!value)}>{showGroups ? "收起群聊目录" : "查找和管理独立群聊"}</Button>
      {showGroups && <GroupDirectory/>}
      <Alert
        type="warning"
        showIcon
        title="停用或恢复圈子需要填写原因、输入确认文字，并记录管理员审计日志。"
      />

      <Space orientation="vertical" size={12} className="page-stack">
        <Space wrap className="page-toolbar">
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

      <Modal
        title={
          <Space>
            <MessageOutlined />
            {modalTitle}
          </Space>
        }
        open={Boolean(pendingAction)}
        okText="确认提交"
        okButtonProps={{ disabled: !canSubmit }}
        confirmLoading={operation.isPending}
        onOk={submitPendingAction}
        onCancel={() => {
          if (!operation.isPending) setPendingAction(null);
        }}
      >
        <Space orientation="vertical" size={12} className="page-stack">
          {pendingActionQueryError ? (
            <Alert
              type="error"
              showIcon
              title="列表刷新失败，请重试成功后再提交"
            />
          ) : null}
          {pendingActionStale && !pendingActionQueryError ? (
            <Alert
              type="warning"
              showIcon
              title="目标状态已变化，请关闭窗口后按最新状态重新操作"
            />
          ) : null}
          <div>
            <Typography.Text>操作原因</Typography.Text>
            <Input.TextArea
              aria-label="操作原因"
              rows={3}
              maxLength={500}
              disabled={operation.isPending}
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
              disabled={operation.isPending}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
