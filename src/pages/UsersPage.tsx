import { PageHeader } from "../components/PageHeader";
import { displayLabel } from "../utils/display";
import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listUsers } from "../api/users";
import { PageError } from "../components/PageError";
import type { AdminUserListItem, UserRole, UserStatus } from "../types";
import { formatDateTime } from "../utils/format";

const PAGE_SIZE = 20;

export interface UserListState {
  keyword?: string;
  status?: UserStatus;
  role?: UserRole;
  createdFrom?: string;
  createdTo?: string;
  page: number;
  limit: number;
}

export const initialUserListState: UserListState = {
  page: 1,
  limit: PAGE_SIZE,
};

type UserListAction =
  | { type: "page"; page: number }
  | {
      type: "filters";
      patch: Partial<
        Pick<
          UserListState,
          "keyword" | "status" | "role" | "createdFrom" | "createdTo"
        >
      >;
    };

export function reduceUserListState(
  state: UserListState,
  action: UserListAction,
): UserListState {
  if (action.type === "page") {
    return { ...state, page: action.page };
  }
  return { ...state, ...action.patch, page: 1 };
}

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function UsersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  // Email/phone searches stay in memory; they must never enter shared URLs.
  const [keyword, setKeyword] = useState<string | undefined>();
  const parsedPage = Number(search.get("page") ?? 1);
  const state: UserListState = {
    page:
      Number.isInteger(parsedPage) && parsedPage > 0 && parsedPage <= 500
        ? parsedPage
        : 1,
    limit: PAGE_SIZE,
    keyword,
    status: ["ACTIVE", "BANNED", "DELETED"].includes(search.get("status") ?? "")
      ? (search.get("status") as UserStatus)
      : undefined,
    role: ["USER", "ADMIN"].includes(search.get("role") ?? "")
      ? (search.get("role") as UserRole)
      : undefined,
    createdFrom: search.get("createdFrom") ?? undefined,
    createdTo: search.get("createdTo") ?? undefined,
  };
  const dispatch = (action: UserListAction) => {
    const next = reduceUserListState(state, action);
    setKeyword(next.keyword);
    setSearch((previous) => {
      const params = new URLSearchParams(previous);
      for (const key of [
        "status",
        "role",
        "createdFrom",
        "createdTo",
        "page",
      ] as const) {
        const value = next[key];
        if (value && value !== 1) params.set(key, String(value));
        else params.delete(key);
      }
      return params;
    });
  };
  const [keywordDraft, setKeywordDraft] = useState("");
  const query = useMemo(
    () => ({
      keyword: state.keyword,
      status: state.status,
      role: state.role,
      createdFrom: toIsoDate(state.createdFrom),
      createdTo: toIsoDate(state.createdTo),
      page: state.page,
      limit: state.limit,
    }),
    [state],
  );
  const users = useQuery({
    queryKey: ["admin-users", query],
    queryFn: () => listUsers(query),
  });

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: "头像",
      dataIndex: "avatarUrl",
      width: 72,
      render: (value: string | null, record) => (
        <Avatar src={value || undefined}>
          {(record.nickname || record.accountId).slice(0, 1).toUpperCase()}
        </Avatar>
      ),
    },
    { title: "账号 ID", dataIndex: "accountId" },
    { title: "昵称", dataIndex: "nickname" },
    {
      title: "邮箱",
      dataIndex: "maskedEmail",
      render: (value: string | null) => value || "-",
    },
    {
      title: "手机号",
      dataIndex: "maskedPhoneNumber",
      render: (value: string | null) => value || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: UserStatus) => (
        <Tag
          color={
            value === "ACTIVE"
              ? "green"
              : value === "BANNED"
                ? "red"
                : "default"
          }
        >
          {displayLabel("userStatus", value)}
        </Tag>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      render: (value: UserRole) => (
        <Tag title={value}>{displayLabel("userRole", value)}</Tag>
      ),
    },
    {
      title: "注册时间",
      dataIndex: "createdAt",
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "最后在线",
      dataIndex: "lastOnline",
      render: (value: string | null) => formatDateTime(value),
    },
    {
      title: "操作",
      fixed: "right",
      width: 110,
      render: (_, record) => (
        <Button size="small" onClick={() => navigate(`/users/${record.id}`)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <Space orientation="vertical" size={16} className="page-stack">
      <PageHeader title="用户管理" description="搜索用户，查看资料、账号状态与相关记录。" />
      <Space wrap className="page-toolbar">
        <Input.Search
          allowClear
          aria-label="搜索用户"
          placeholder="账号 ID、昵称，或完整邮箱 / 手机号"
          value={keywordDraft}
          onChange={(event) => {
            const value = event.target.value;
            setKeywordDraft(value);
            if (!value) {
              dispatch({ type: "filters", patch: { keyword: undefined } });
            }
          }}
          onSearch={(value) =>
            dispatch({
              type: "filters",
              patch: { keyword: value.trim() || undefined },
            })
          }
          style={{ width: 300 }}
        />
        <Select<UserStatus>
          allowClear
          aria-label="用户状态"
          placeholder="状态"
          value={state.status}
          onChange={(status) =>
            dispatch({ type: "filters", patch: { status } })
          }
          style={{ width: 150 }}
          options={["ACTIVE", "BANNED", "DELETED"].map((value) => ({
            value,
            label: displayLabel("userStatus", value),
          }))}
        />
        <Select<UserRole>
          allowClear
          aria-label="用户角色"
          placeholder="角色"
          value={state.role}
          onChange={(role) => dispatch({ type: "filters", patch: { role } })}
          style={{ width: 150 }}
          options={["USER", "MEMBER", "ADMIN"].map((value) => ({
            value,
            label: displayLabel("userRole", value),
          }))}
        />
        <Input
          aria-label="注册开始时间"
          type="datetime-local"
          value={state.createdFrom || ""}
          onChange={(event) =>
            dispatch({
              type: "filters",
              patch: { createdFrom: event.target.value || undefined },
            })
          }
          style={{ width: 210 }}
        />
        <Input
          aria-label="注册结束时间"
          type="datetime-local"
          value={state.createdTo || ""}
          onChange={(event) =>
            dispatch({
              type: "filters",
              patch: { createdTo: event.target.value || undefined },
            })
          }
          style={{ width: 210 }}
        />
      </Space>
      {users.isError ? (
        <PageError
          error={users.error}
          onRetry={() => users.refetch()}
          message="用户列表加载失败"
        />
      ) : null}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={users.data?.items || []}
        loading={users.isLoading}
        scroll={{ x: 1400 }}
        locale={{ emptyText: users.isError ? "加载失败" : "暂无用户" }}
        pagination={{
          current: state.page,
          pageSize: state.limit,
          total: users.data?.total || 0,
          showSizeChanger: false,
          onChange: (page) => dispatch({ type: "page", page }),
        }}
      />
    </Space>
  );
}
