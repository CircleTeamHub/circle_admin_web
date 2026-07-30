import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Descriptions,
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
import { useMemo, useState } from "react";
import {
  getUserAvatarFrames,
  grantAvatarFrame,
  listAvatarFrameAssets,
  revokeAvatarFrameGrant,
  type AvatarFrameGrant,
  type AvatarFrameInventoryItem,
} from "../api/avatar-frames";
import { formatDateTime } from "../utils/format";
import { getErrorMessage } from "../utils/errors";
import { PageError } from "./PageError";

function expiryLabel(value: string | null): string {
  return value ? formatDateTime(value) : "永久";
}

function sourceLabel(item: AvatarFrameInventoryItem): string {
  return item.ownedSources
    .map((source) =>
      source.type === "MEMBERSHIP"
        ? `会员 Lv.${source.minimumVipLevel}`
        : "管理员发放",
    )
    .join("、");
}

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function UserAvatarFramesCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [grantOpen, setGrantOpen] = useState(false);
  const [frameId, setFrameId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantRequestKey, setGrantRequestKey] = useState("");
  const [revokeTarget, setRevokeTarget] = useState<AvatarFrameGrant | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  const rotateGrantRequestKey = () => {
    setGrantRequestKey(newIdempotencyKey());
  };

  const assets = useQuery({
    queryKey: ["admin-avatar-frame-assets"],
    queryFn: listAvatarFrameAssets,
  });
  const inventory = useInfiniteQuery({
    queryKey: ["admin-avatar-frames", userId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      getUserAvatarFrames(userId, { cursor: pageParam, limit: 50 }),
    getNextPageParam: (page) => page.grants.nextCursor || undefined,
  });
  const current = inventory.data?.pages[0];
  const grants = useMemo(
    () => inventory.data?.pages.flatMap((page) => page.grants.items) ?? [],
    [inventory.data],
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["admin-avatar-frames", userId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["admin-user-audit", userId],
      }),
    ]);
  };

  const grantMutation = useMutation({
    mutationFn: () =>
      grantAvatarFrame(userId, {
        frameId,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        reason: grantReason.trim(),
        idempotencyKey: grantRequestKey,
      }),
    onSuccess: async ({ replayed }) => {
      setGrantOpen(false);
      setFrameId("");
      setExpiresAt("");
      setGrantReason("");
      setGrantRequestKey("");
      message.success(replayed ? "该发放请求已处理" : "头像框已发放");
      await refresh();
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "头像框发放失败"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: () => {
      if (!revokeTarget) throw new Error("未选择发放记录");
      return revokeAvatarFrameGrant(revokeTarget.id, {
        reason: revokeReason.trim(),
      });
    },
    onSuccess: async ({ replayed }) => {
      setRevokeTarget(null);
      setRevokeReason("");
      message.success(replayed ? "该撤销请求已处理" : "头像框授权已撤销");
      await refresh();
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "头像框撤销失败"));
    },
  });

  const inventoryColumns: ColumnsType<AvatarFrameInventoryItem> = [
    {
      title: "头像框",
      render: (_, item) => (
        <Space>
          <Avatar src={item.imageUrl || undefined}>{item.name.slice(0, 1)}</Avatar>
          <span>{item.name}</span>
          {item.equipped ? <Tag color="purple">佩戴中</Tag> : null}
        </Space>
      ),
    },
    { title: "来源", render: (_, item) => sourceLabel(item) },
    {
      title: "有效至",
      dataIndex: "availableUntil",
      render: expiryLabel,
    },
  ];
  const grantColumns: ColumnsType<AvatarFrameGrant> = [
    {
      title: "头像框",
      render: (_, grant) => grant.frame?.name || grant.frameId,
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (status: AvatarFrameGrant["status"]) => (
        <Tag
          color={
            status === "ACTIVE"
              ? "green"
              : status === "REVOKED"
                ? "red"
                : "default"
          }
        >
          {{ ACTIVE: "有效", EXPIRED: "已过期", REVOKED: "已撤销" }[status]}
        </Tag>
      ),
    },
    { title: "发放原因", dataIndex: "reason" },
    { title: "有效至", dataIndex: "expiresAt", render: expiryLabel },
    {
      title: "发放时间",
      dataIndex: "createdAt",
      render: formatDateTime,
    },
    {
      title: "操作",
      render: (_, grant) => (
        <Button
          danger
          size="small"
          disabled={grant.status !== "ACTIVE" || revokeMutation.isPending}
          onClick={() => setRevokeTarget(grant)}
        >
          撤销
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card
        title="头像框管理"
        extra={
          <Button
            type="primary"
            disabled={!assets.data?.length}
            onClick={() => {
              setGrantRequestKey(newIdempotencyKey());
              setGrantOpen(true);
            }}
          >
            发放头像框
          </Button>
        }
      >
        {assets.isError ? (
          <Alert
            type="error"
            showIcon
            message="头像框目录加载失败"
            action={<Button onClick={() => assets.refetch()}>重试目录</Button>}
            style={{ marginBottom: 16 }}
          />
        ) : null}
        {inventory.isError ? (
          <PageError
            error={inventory.error}
            onRetry={() => inventory.refetch()}
            message="头像框信息加载失败"
          />
        ) : (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions column={1} size="small" title="当前展示">
              <Descriptions.Item label="头像框">
                {current?.equippedFrame?.name || "不展示头像框"}
              </Descriptions.Item>
              {current?.equippedFrame ? (
                <Descriptions.Item label="展示有效至">
                  {expiryLabel(current.equippedFrameExpiresAt)}
                </Descriptions.Item>
              ) : null}
            </Descriptions>

            <Typography.Title level={5}>当前拥有</Typography.Title>
            <Table
              rowKey="id"
              size="small"
              loading={inventory.isLoading}
              columns={inventoryColumns}
              dataSource={current?.items ?? []}
              pagination={false}
              locale={{ emptyText: "当前没有可用头像框" }}
            />

            <Typography.Title level={5}>管理员发放记录</Typography.Title>
            <Table
              rowKey="id"
              size="small"
              loading={inventory.isLoading}
              columns={grantColumns}
              dataSource={grants}
              pagination={false}
              locale={{ emptyText: "暂无管理员发放记录" }}
            />
            {inventory.hasNextPage ? (
              <Button
                loading={inventory.isFetchingNextPage}
                onClick={() => inventory.fetchNextPage()}
              >
                加载更多记录
              </Button>
            ) : null}
          </Space>
        )}
      </Card>

      <Modal
        title="发放头像框"
        open={grantOpen}
        okText="确认发放"
        cancelText="取消"
        confirmLoading={grantMutation.isPending}
        closable={!grantMutation.isPending}
        mask={{ closable: !grantMutation.isPending }}
        keyboard={!grantMutation.isPending}
        cancelButtonProps={{ disabled: grantMutation.isPending }}
        okButtonProps={{
          disabled:
            !grantRequestKey ||
            !frameId ||
            grantReason.trim().length === 0 ||
            grantReason.trim().length > 500 ||
            (!!expiresAt && new Date(expiresAt).getTime() <= Date.now()),
        }}
        onCancel={() => {
          if (grantMutation.isPending) return;
          setGrantOpen(false);
          setGrantRequestKey("");
        }}
        onOk={() => grantMutation.mutate()}
        destroyOnHidden
      >
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          {assets.isError ? (
            <Alert
              type="error"
              showIcon
              message="头像框目录加载失败"
              action={<Button onClick={() => assets.refetch()}>重试</Button>}
            />
          ) : null}
          <Select
            aria-label="选择头像框"
            placeholder="选择头像框"
            loading={assets.isLoading}
            disabled={grantMutation.isPending}
            value={frameId || undefined}
            options={(assets.data ?? []).map((asset) => ({
              value: asset.id,
              label: asset.name,
            }))}
            onChange={(value) => {
              setFrameId(value);
              rotateGrantRequestKey();
            }}
            style={{ width: "100%" }}
          />
          <label>
            <Typography.Text>到期时间（留空为永久）</Typography.Text>
            <Input
              aria-label="到期时间"
              type="datetime-local"
              disabled={grantMutation.isPending}
              value={expiresAt}
              onChange={(event) => {
                setExpiresAt(event.target.value);
                rotateGrantRequestKey();
              }}
            />
          </label>
          <Input.TextArea
            aria-label="发放原因"
            placeholder="客服工单号或发放原因"
            rows={3}
            maxLength={500}
            showCount
            disabled={grantMutation.isPending}
            value={grantReason}
            onChange={(event) => {
              setGrantReason(event.target.value);
              rotateGrantRequestKey();
            }}
          />
        </Space>
      </Modal>

      <Modal
        title={`撤销 ${revokeTarget?.frame?.name || "头像框"} 授权`}
        open={revokeTarget !== null}
        okText="确认撤销"
        cancelText="取消"
        okButtonProps={{
          danger: true,
          disabled:
            revokeReason.trim().length === 0 ||
            revokeReason.trim().length > 500,
        }}
        confirmLoading={revokeMutation.isPending}
        closable={!revokeMutation.isPending}
        mask={{ closable: !revokeMutation.isPending }}
        keyboard={!revokeMutation.isPending}
        cancelButtonProps={{ disabled: revokeMutation.isPending }}
        onCancel={() => {
          if (revokeMutation.isPending) return;
          setRevokeTarget(null);
          setRevokeReason("");
        }}
        onOk={() => revokeMutation.mutate()}
        destroyOnHidden
      >
        <Input.TextArea
          aria-label="撤销原因"
          placeholder="客服工单号或撤销原因"
          rows={3}
          maxLength={500}
          showCount
          value={revokeReason}
          onChange={(event) => setRevokeReason(event.target.value)}
        />
      </Modal>
    </>
  );
}
