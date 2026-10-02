import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  listImMembers,
  moderateImMember,
  type ImMember,
  type MemberAction,
} from "../api/admin-im";

export function GroupMembersPage() {
  const { conversationId = "" } = useParams();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<ImMember>();
  const [action, setAction] = useState<MemberAction>("mute");
  const [reason, setReason] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [uncertain, setUncertain] = useState(false);
  const members = useQuery({
    queryKey: ["admin-im-members", conversationId, keyword, page],
    queryFn: () => listImMembers(conversationId, keyword, page),
    enabled: !!conversationId,
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: () =>
      moderateImMember(
        conversationId,
        target!.id,
        action,
        reason.trim(),
        action === "role" ? role : undefined,
      ),
  });
  const open = (m: ImMember) => {
    setTarget(m);
    setReason("");
    setUncertain(false);
    setAction(m.silenced ? "unmute" : "mute");
    setRole(m.role === "ADMIN" ? "MEMBER" : "ADMIN");
    mutation.reset();
  };
  const submit = async () => {
    try {
      await mutation.mutateAsync();
      setTarget(undefined);
      await members.refetch();
    } catch {
      setUncertain(true);
    }
  };
  return (
    <Space direction="vertical" style={{ width: "100%" }}>
      <Link to="/im">返回会话管理</Link>
      <Typography.Title level={3}>
        群成员 · {members.data?.name ?? conversationId}
      </Typography.Title>
      <Typography.Text>
        圈子关联：
        {members.data?.circle
          ? `${members.data.circle.name} (${members.data.circle.id})`
          : "独立群"}
      </Typography.Text>
      <Space>
        <Input.Search
          aria-label="搜索成员"
          placeholder="成员 ID / 群昵称"
          onSearch={(v) => {
            setKeyword(v);
            setPage(1);
          }}
        />
        <Button
          loading={members.isFetching}
          onClick={() => void members.refetch()}
        >
          刷新成员
        </Button>
      </Space>
      {members.isError && (
        <Alert type="error" message="成员加载失败；需要 IM_MODERATE 权限。" />
      )}
      <Table<ImMember>
        rowKey="id"
        dataSource={members.data?.items}
        loading={members.isFetching}
        pagination={{
          current: page,
          total: members.data?.total,
          pageSize: 30,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "成员",
            render: (_, m) => (
              <span>
                {m.nickname}
                <br />
                {m.id}
              </span>
            ),
          },
          { title: "角色", dataIndex: "role" },
          {
            title: "禁言",
            render: (_, m) =>
              m.silenced ? (
                <Tag color="red">
                  {m.silencedUntil
                    ? new Date(m.silencedUntil).toLocaleString()
                    : "直到解除"}
                </Tag>
              ) : (
                "未禁言"
              ),
          },
          {
            title: "加入时间",
            dataIndex: "joinedAt",
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: "操作",
            render: (_, m) => (
              <Button
                disabled={m.role === "OWNER" || m.role === "UNAVAILABLE"}
                onClick={() => open(m)}
              >
                管理成员
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={`确认管理 ${target?.nickname ?? ""}`}
        open={!!target}
        closable={!mutation.isPending}
        maskClosable={false}
        cancelButtonProps={{ disabled: mutation.isPending }}
        onCancel={() => setTarget(undefined)}
        onOk={() => void submit()}
        okText="确认执行"
        confirmLoading={mutation.isPending}
        okButtonProps={{
          disabled: reason.trim().length < 2 || mutation.isPending || uncertain,
        }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Alert
            type="warning"
            message="此操作立即影响群成员权限。群主和本人受保护；移除成员会收回群访问权限。"
          />
          <Select
            aria-label="成员操作"
            value={action}
            style={{ width: "100%" }}
            disabled={mutation.isPending || uncertain}
            options={[
              { value: "mute", label: "禁言直到解除" },
              { value: "unmute", label: "解除禁言" },
              { value: "remove", label: "移除成员" },
              { value: "role", label: "设置角色" },
            ]}
            onChange={setAction}
          />
          {action === "role" && (
            <Select
              aria-label="目标角色"
              value={role}
              disabled={mutation.isPending || uncertain}
              options={[
                { value: "ADMIN", label: "管理员" },
                { value: "MEMBER", label: "普通成员" },
              ]}
              onChange={setRole}
            />
          )}
          <Input.TextArea
            aria-label="操作原因"
            placeholder="操作原因（2–500 字）"
            maxLength={500}
            value={reason}
            disabled={mutation.isPending}
            onChange={(e) => setReason(e.target.value)}
          />
          {mutation.isError && (
            <Alert
              type="error"
              message="操作未确认成功，输入已保留。请刷新核对成员状态后，再发起新的操作；系统不会自动重试。"
            />
          )}
          {uncertain && (
            <Button
              loading={members.isFetching}
              onClick={async () => {
                const result = await members.refetch();
                if (result.isSuccess) setTarget(undefined);
              }}
            >
              刷新并核对成员状态
            </Button>
          )}
        </Space>
      </Modal>
    </Space>
  );
}
