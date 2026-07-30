import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useRef, useState } from "react";
import {
  addFancyNumberRecommendations,
  listFancyNumberRecommendations,
  reorderFancyNumberRecommendations,
  setFancyNumberRecommendation,
  type FancyNumberRecommendation,
  type FancyNumberStatus,
} from "../api/fancy-numbers";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

const RECOMMENDATION_PATTERN = /^[A-Z0-9]{6}$/;
const RECOMMENDATION_LIMIT = 100;
const QUERY_KEY = ["fancyNumberRecommendations"] as const;

const STATUS_LABELS: Record<FancyNumberStatus, string> = {
  AVAILABLE: "可购买",
  LEASED: "租用中",
  PERMANENT: "永久占用",
  DISABLED: "已停用",
};

const STATUS_COLORS: Record<FancyNumberStatus, string> = {
  AVAILABLE: "green",
  LEASED: "blue",
  PERMANENT: "purple",
  DISABLED: "default",
};

export function parseRecommendationValues(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,，]+/)
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function moveItem(
  items: FancyNumberRecommendation[],
  fromIndex: number,
  toIndex: number,
): FancyNumberRecommendation[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function FancyNumbersPage() {
  const queryClient = useQueryClient();
  const [orderedItems, setOrderedItems] = useState<
    FancyNumberRecommendation[]
  >([]);
  const [addOpen, setAddOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const draggedIdRef = useRef<string | null>(null);

  const recommendations = useQuery({
    queryKey: QUERY_KEY,
    queryFn: listFancyNumberRecommendations,
  });

  useEffect(() => {
    if (recommendations.data) {
      setOrderedItems(recommendations.data.items);
    }
  }, [recommendations.data]);

  const refreshRecommendations = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addMutation = useMutation({
    mutationFn: addFancyNumberRecommendations,
    onSuccess: () => {
      setAddOpen(false);
      setInputValue("");
      message.success("热门靓号已添加");
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "添加热门靓号失败"));
    },
    onSettled: refreshRecommendations,
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      id,
      recommended,
    }: {
      id: string;
      recommended: boolean;
    }) => setFancyNumberRecommendation(id, recommended),
    onSuccess: () => {
      message.success("已从热门推荐下架");
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "更新热门推荐失败"));
    },
    onSettled: refreshRecommendations,
  });

  const reorderMutation = useMutation({
    mutationFn: ({
      expectedIds,
      ids,
    }: {
      expectedIds: string[];
      ids: string[];
    }) => reorderFancyNumberRecommendations(expectedIds, ids),
    onError: (error) => {
      setOrderedItems(recommendations.data?.items ?? []);
      message.error(
        getErrorMessage(error, "排序保存失败，列表已刷新，请重试"),
      );
    },
    onSettled: refreshRecommendations,
  });

  const writePending =
    addMutation.isPending ||
    toggleMutation.isPending ||
    reorderMutation.isPending;

  const commitOrder = (next: FancyNumberRecommendation[]) => {
    if (writePending) return;
    const expectedIds = orderedItems.map((item) => item.id);
    const ids = next.map((item) => item.id);
    if (ids.every((id, index) => id === expectedIds[index])) return;
    setOrderedItems(next);
    reorderMutation.mutate({ expectedIds, ids });
  };

  const moveBy = (id: string, offset: number) => {
    const fromIndex = orderedItems.findIndex((item) => item.id === id);
    commitOrder(moveItem(orderedItems, fromIndex, fromIndex + offset));
  };

  const columns: ColumnsType<FancyNumberRecommendation> = [
    {
      title: "排序",
      width: 150,
      render: (_, record, index) => (
        <Space size={4}>
          <HolderOutlined title="拖动排序" />
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            aria-label={`上移 ${record.value}`}
            disabled={index === 0 || writePending}
            onClick={() => moveBy(record.id, -1)}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            aria-label={`下移 ${record.value}`}
            disabled={index === orderedItems.length - 1 || writePending}
            onClick={() => moveBy(record.id, 1)}
          />
        </Space>
      ),
    },
    {
      title: "靓号",
      dataIndex: "value",
      render: (value: string) => (
        <Typography.Text strong className="fancy-number-value">
          {value}
        </Typography.Text>
      ),
    },
    {
      title: "库存状态",
      dataIndex: "status",
      render: (status: FancyNumberStatus) => (
        <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: "来源",
      dataIndex: "source",
      render: (source: FancyNumberRecommendation["source"]) =>
        source === "ADMIN"
          ? "管理员添加"
          : source === "CUSTOM"
            ? "用户自定义"
            : "历史靓号",
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "操作",
      width: 120,
      render: (_, record) => (
        <Button
          danger
          size="small"
          aria-label={`从热门下架 ${record.value}`}
          loading={
            toggleMutation.isPending &&
            toggleMutation.variables?.id === record.id
          }
          disabled={writePending}
          onClick={() =>
            toggleMutation.mutate({ id: record.id, recommended: false })
          }
        >
          下架
        </Button>
      ),
    },
  ];

  const submitAdd = () => {
    if (writePending) return;
    const values = parseRecommendationValues(inputValue);
    if (values.length < 1) {
      message.error("请输入至少一个靓号");
      return;
    }
    if (values.length > RECOMMENDATION_LIMIT) {
      message.error("单次最多添加 100 个靓号");
      return;
    }
    if (values.some((value) => !RECOMMENDATION_PATTERN.test(value))) {
      message.error("每个靓号必须是 6 位英文字母或数字");
      return;
    }
    addMutation.mutate(values);
  };

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <Space className="page-title-row">
        <div>
          <Typography.Title level={3}>热门靓号</Typography.Title>
          <Typography.Text type="secondary">
            管理 App 靓号专区的热门推荐及显示顺序
          </Typography.Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          aria-label="添加热门靓号"
          disabled={writePending}
          onClick={() => setAddOpen(true)}
        >
          添加热门靓号
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        title="被购买的号码会自动从 App 热门推荐中隐藏，释放后会按原推荐配置重新显示；下架推荐不会禁用该号码。"
      />

      {recommendations.isError ? (
        <PageError
          error={recommendations.error}
          onRetry={() => recommendations.refetch()}
          message="热门靓号加载失败"
        />
      ) : null}

      <Table
        rowKey="id"
        columns={columns}
        dataSource={orderedItems}
        loading={recommendations.isLoading}
        pagination={false}
        locale={{
          emptyText: recommendations.isError
            ? "加载失败"
            : "暂无热门靓号，可点击右上角添加",
        }}
        onRow={(record) => ({
          className: "fancy-number-recommendation-row",
          draggable: !writePending,
          onDragStart: () => {
            if (writePending) return;
            draggedIdRef.current = record.id;
          },
          onDragEnd: () => {
            draggedIdRef.current = null;
          },
          onDragOver: (event) => {
            if (draggedIdRef.current) event.preventDefault();
          },
          onDrop: () => {
            const draggedId = draggedIdRef.current;
            draggedIdRef.current = null;
            if (writePending) return;
            if (!draggedId || draggedId === record.id) return;
            const fromIndex = orderedItems.findIndex(
              (item) => item.id === draggedId,
            );
            const toIndex = orderedItems.findIndex(
              (item) => item.id === record.id,
            );
            commitOrder(moveItem(orderedItems, fromIndex, toIndex));
          },
        })}
      />

      <Modal
        title="添加热门靓号"
        open={addOpen}
        okText="确认添加"
        cancelText="取消"
        confirmLoading={addMutation.isPending}
        okButtonProps={{ disabled: writePending }}
        cancelButtonProps={{ disabled: writePending }}
        onOk={submitAdd}
        onCancel={() => {
          if (writePending) return;
          setAddOpen(false);
          setInputValue("");
        }}
      >
        <Space orientation="vertical" size={8} className="page-stack">
          <Typography.Text>
            每个靓号必须是 6 位英文字母或数字，可用逗号、空格或换行分隔。
          </Typography.Text>
          <Input.TextArea
            aria-label="靓号列表"
            rows={6}
            maxLength={700}
            placeholder={"例如：\nABC123\n888888"}
            value={inputValue}
            disabled={writePending}
            onChange={(event) => setInputValue(event.target.value)}
          />
        </Space>
      </Modal>
    </Space>
  );
}
