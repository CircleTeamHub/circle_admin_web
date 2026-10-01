import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from "antd";
import {
  batchNumbers,
  listInventory,
  listNumberOrders,
  listNumberOwnership,
  toggleNumber,
  type Inventory,
  type NumberOrder,
  type NumberOwnership,
} from "../api/admin-commerce";
import { formatDateTime } from "../utils/format";
import { getErrorMessage } from "../utils/errors";
export function FancyInventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>();
  const [cursor, setCursor] = useState<string>();
  const [orderSearch, setOrderSearch] = useState("");
  const [orderCursor, setOrderCursor] = useState<string>();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inventory = useQuery({
    queryKey: ["fancyInventory", search, status, cursor],
    queryFn: () => listInventory({ search, status, cursor }),
  });
  const orders = useQuery({
    queryKey: ["fancyOrders", orderSearch, orderCursor],
    queryFn: () =>
      listNumberOrders({ search: orderSearch, cursor: orderCursor }),
  });
  const ownership = useQuery({
    queryKey: ["fancyOwnership", inventory.data?.items.map((i) => i.id)],
    queryFn: () =>
      listNumberOwnership({
        ids: inventory.data?.items.map((i) => i.id).join(","),
        limit: 50,
      }),
    enabled: !!inventory.data?.items.length,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["fancyInventory"] });
  const add = useMutation({
    mutationFn: batchNumbers,
    retry: false,
    onSuccess: () => {
      setOpen(false);
      setInput("");
      message.success("库存已添加");
      void refresh();
    },
    onError: (e) => message.error(getErrorMessage(e, "添加失败")),
  });
  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleNumber(id, enabled),
    retry: false,
    onSuccess: () => {
      void refresh();
    },
    onError: (e) => message.error(getErrorMessage(e, "状态更新失败")),
  });
  const busy = add.isPending || toggle.isPending;
  return (
    <Space orientation="vertical" className="page-stack">
      <Typography.Title level={3}>靓号库存</Typography.Title>
      <Space wrap>
        <Input.Search
          placeholder="号码"
          maxLength={32}
          onSearch={(v) => {
            setSearch(v);
            setCursor(undefined);
          }}
        />
        <Select
          allowClear
          placeholder="状态"
          style={{ width: 150 }}
          options={["AVAILABLE", "LEASED", "PERMANENT", "DISABLED"].map(
            (value) => ({ value, label: value }),
          )}
          onChange={(v) => {
            setStatus(v);
            setCursor(undefined);
          }}
        />
        <Button disabled={busy} onClick={() => setOpen(true)}>
          批量添加
        </Button>
      </Space>
      {inventory.isError && (
        <Alert
          type="error"
          title="库存加载失败"
          action={
            <Button onClick={() => void inventory.refetch()}>重试</Button>
          }
        />
      )}
      <Table<Inventory>
        rowKey="id"
        dataSource={inventory.data?.items ?? []}
        loading={inventory.isLoading}
        pagination={false}
        columns={[
          { title: "号码", dataIndex: "value" },
          { title: "状态", dataIndex: "status" },
          { title: "来源", dataIndex: "source" },
          {
            title: "操作",
            render: (_, r) => (
              <Space>
                <Button
                  onClick={() => {
                    setOrderSearch(r.value);
                    setOrderCursor(undefined);
                  }}
                >
                  查看订单与归属
                </Button>
                <Button
                  disabled={
                    busy || !["AVAILABLE", "DISABLED"].includes(r.status)
                  }
                  onClick={() =>
                    Modal.confirm({
                      title: `确认${r.status === "DISABLED" ? "启用" : "停用"} ${r.value}？`,
                      onOk: () =>
                        toggle.mutateAsync({
                          id: r.id,
                          enabled: r.status === "DISABLED",
                        }),
                    })
                  }
                >
                  {r.status === "DISABLED" ? "启用" : "停用"}
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Space>
        <Button disabled={!cursor} onClick={() => setCursor(undefined)}>
          首页
        </Button>
        <Button
          disabled={!inventory.data?.nextCursor || inventory.isFetching}
          onClick={() => setCursor(inventory.data!.nextCursor!)}
        >
          下一页
        </Button>
      </Space>
      {ownership.isError && (
        <Alert
          type="error"
          title="归属加载失败"
          action={
            <Button onClick={() => void ownership.refetch()}>重试</Button>
          }
        />
      )}
      <Table<NumberOwnership>
        rowKey="id"
        dataSource={
          inventory.data?.items.length ? (ownership.data?.items ?? []) : []
        }
        loading={ownership.isFetching}
        pagination={false}
        columns={[
          { title: "号码归属", dataIndex: "value" },
          {
            title: "当前账号",
            render: (_, r) => r.leases[0]?.user.accountId ?? "无",
          },
          {
            title: "有效期",
            render: (_, r) =>
              r.leases[0]?.permanentAt
                ? "永久"
                : r.leases[0]?.expiresAt
                  ? formatDateTime(r.leases[0].expiresAt)
                  : "无",
          },
        ]}
      />
      <Typography.Title level={4}>订单、当前归属与有效期</Typography.Title>
      <Input.Search
        value={orderSearch}
        onChange={(e) => {
          setOrderSearch(e.target.value);
          setOrderCursor(undefined);
        }}
        maxLength={64}
        placeholder="账号或号码"
      />
      {orders.isError && (
        <Alert
          type="error"
          title="订单加载失败"
          action={<Button onClick={() => void orders.refetch()}>重试</Button>}
        />
      )}
      <Table<NumberOrder>
        rowKey="id"
        dataSource={orders.data?.items ?? []}
        loading={orders.isLoading}
        pagination={false}
        scroll={{ x: 900 }}
        columns={[
          { title: "号码", render: (_, r) => r.fancyNumber.value },
          { title: "下单账号", render: (_, r) => r.user.accountId },
          {
            title: "当前归属",
            render: (_, r) => r.fancyNumber.leases[0]?.user.accountId ?? "无",
          },
          {
            title: "当前有效期",
            render: (_, r) => {
              const lease = r.fancyNumber.leases[0];
              return lease?.permanentAt
                ? "永久"
                : lease?.expiresAt
                  ? formatDateTime(lease.expiresAt)
                  : "无";
            },
          },
          { title: "订单类型", dataIndex: "type" },
          { title: "价格", dataIndex: "totalPrice" },
          { title: "订单时间", dataIndex: "createdAt", render: formatDateTime },
        ]}
      />
      <Space>
        <Button
          disabled={!orderCursor}
          onClick={() => setOrderCursor(undefined)}
        >
          首页
        </Button>
        <Button
          disabled={!orders.data?.nextCursor || orders.isFetching}
          onClick={() => setOrderCursor(orders.data!.nextCursor!)}
        >
          下一页
        </Button>
      </Space>
      <Modal
        title="批量添加库存"
        open={open}
        confirmLoading={add.isPending}
        cancelButtonProps={{ disabled: busy }}
        onCancel={() => {
          if (!busy) setOpen(false);
        }}
        onOk={() => {
          if (busy) return;
          const values = [
            ...new Set(
              input
                .split(/[\s,，]+/)
                .map((v) => v.trim().toLowerCase())
                .filter(Boolean),
            ),
          ];
          if (
            !values.length ||
            values.length > 100 ||
            values.some((v) => !/^[a-z0-9_-]{4,32}$/.test(v))
          ) {
            message.error(
              "请输入 1 至 100 个 4–32 位字母、数字、下划线或短横线号码",
            );
            return;
          }
          add.mutate(values);
        }}
      >
        <Input.TextArea
          value={input}
          maxLength={3400}
          rows={6}
          disabled={busy}
          placeholder="用空格、逗号或换行分隔"
          onChange={(e) => setInput(e.target.value)}
        />
      </Modal>
    </Space>
  );
}
