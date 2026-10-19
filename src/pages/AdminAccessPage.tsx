import { useAdminAccountAvailability } from "../components/useAdminAccountAvailability";
import { DeleteAdminAccountButton } from "../components/DeleteAdminAccountButton";
import { clearSession, getSessionEpoch } from "../auth/session";
import { ResetAdminPasswordButton } from "../components/ResetAdminPasswordButton";
import { CreateAdminButton } from "../components/CreateAdminButton";
import { CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  message,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { getMe } from "../api/auth";
import { ApiError } from "../api/client";
import {
  getPlatformAccess,
  platformList,
  platformWrite,
  type AdminAccount,
  type ConsoleRole,
} from "../api/platform";
import { PageError } from "../components/PageError";

const roles: ConsoleRole[] = [
  "SUPER_ADMIN",
  "OPERATIONS",
  "MODERATOR",
  "SUPPORT",
];
const abilities =
  "超级管理员：全部权限；运营管理员：仪表盘、用户查看、社群、商务、内容；审核管理员：仪表盘、用户查看与处置、社群、IM 查看与处置、审核、审计；客服管理员：用户查看、IM 查看、客服、充值。";
export function AdminAccessPage() {
  const client=useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [conflict, setConflict] = useState(false);
  const [form] = Form.useForm();
  const availability=useAdminAccountAvailability(form,!!selected,selected?.id);
  const me = useQuery({ queryKey: ["auth-me"], queryFn: getMe });
  const access = useQuery({
    queryKey: ["platform-access-me"],
    queryFn: getPlatformAccess,
  });
  const list = useQuery({
    queryKey: ["admin-access-accounts", search, page],
    queryFn: () =>
      platformList<AdminAccount>("/admin/access/accounts", {
        search,
        page,
        limit: 20,
      }),
  });
  async function save(values: { nickname:string;accountId:string;role: ConsoleRole; reason: string }) {
    if (!selected || busy || conflict || !availability.available) return;
    const epoch=getSessionEpoch();
    const target=selected;
    Modal.confirm({
      title: "确认保存管理员资料",
      content: `${values.nickname}（${values.accountId}） · ${displayLabel("consoleRole", values.role)}；修改登录账号或角色后，对方需要重新登录。`,
      onOk: async () => {
        if(getSessionEpoch()!==epoch) return;
        setBusy(true);
        setError(undefined);
        try {
          await platformWrite(
            `/admin/access/accounts/${target.id}`,
            "PATCH",
            {
              ...values,
              reason: values.reason.trim(),
              nickname: values.nickname.trim(),
              accountId: values.accountId.trim().toLowerCase(),
              version: target.version,
            },
          );
          if(getSessionEpoch()!==epoch) return;
          setSelected(null);
          if(target.id === (me.data?.userId || me.data?.id) && values.accountId.trim().toLowerCase() !== target.accountId){clearSession();return;}
          await Promise.all([list.refetch(),client.invalidateQueries({queryKey:["me"]}),client.invalidateQueries({queryKey:["auth-me"]})]);
        } catch (e) {
          setError(e);
          setConflict(e instanceof ApiError && e.status === 409);
        } finally {
          setBusy(false);
        }
      },
    });
  }
  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      <Space style={{width:"100%",justifyContent:"space-between"}} wrap><Typography.Title level={3}>管理员权限</Typography.Title>{access.data?.role === "SUPER_ADMIN" && <CreateAdminButton onCreated={()=>{void list.refetch();}}/>}</Space>
      <Alert
        type="info"
        message={abilities}
        description="超级管理员可新增、编辑、删除管理员账号及重置密码。其他管理员只能使用分配的密码登录，不能自行修改。"
      />
      <Typography.Text>
        当前角色：
        {access.data ? displayLabel("consoleRole", access.data.role) : "加载中"}
      </Typography.Text>
      {(me.error || access.error) && (
        <PageError
          error={me.error || access.error}
          onRetry={() => {
            void me.refetch();
            void access.refetch();
          }}
        />
      )}
      <Input.Search
        maxLength={64}
        placeholder="账号 / 昵称"
        allowClear
        onSearch={(value) => {
          setSearch(value.trim());
          setPage(1);
        }}
        style={{ maxWidth: 400 }}
      />
      {list.error && (
        <PageError error={list.error} onRetry={() => void list.refetch()} />
      )}
      <Table<AdminAccount>
        rowKey="id"
        scroll={{x:1000}}
        dataSource={list.data?.items ?? []}
        loading={list.isFetching}
        pagination={{
          current: page,
          pageSize: 20,
          total: Math.min(list.data?.total ?? 0, 10000),
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          { title: "账号", dataIndex: "accountId" },
          { title: "昵称", dataIndex: "nickname" },
          {
            title: "状态",
            dataIndex: "status",
            render: (value: string | null) => (
              <CodeValue domain="userStatus" value={value} />
            ),
          },
          {
            title: "角色",
            render: (_, r) => (
              <CodeValue domain="consoleRole" value={r.consoleRole} />
            ),
          },
          {
            title: "操作",
            width:320,
            fixed:"right",
            render: (_, row) => (
              <Space wrap>
              <Button
                disabled={
                  !me.data ||
                  access.data?.role !== "SUPER_ADMIN" ||
                  row.status !== "ACTIVE"
                }
                onClick={() => {
                  setSelected(row);
                  setError(undefined);
                  setConflict(false);
                  form.resetFields();
                  form.setFieldsValue({ nickname:row.nickname,accountId:row.accountId,role: row.consoleRole || undefined });
                }}
              >
                编辑
              </Button>
              {access.data?.role === "SUPER_ADMIN" && row.status === "ACTIVE" && <ResetAdminPasswordButton account={row} ownAccount={row.id === (me.data?.userId || me.data?.id)}/>}
              {access.data?.role === "SUPER_ADMIN" && <DeleteAdminAccountButton account={row} ownAccount={row.id === (me.data?.userId || me.data?.id)} onDeleted={()=>{void list.refetch();}}/>}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title="编辑管理员"
        open={!!selected}
        confirmLoading={busy}
        okButtonProps={{ disabled: conflict || !availability.available }}
        onOk={() => form.submit()}
        onCancel={() => {
          if (!busy) setSelected(null);
        }}
      >
        {!!error && <PageError error={error} />}
        {conflict && (
          <Button
            onClick={async () => {
              const result = await list.refetch();
              const row = result.data?.items.find((r) => r.id === selected?.id);
              if (row) {
                setSelected(row);
                form.resetFields();
                form.setFieldsValue({ nickname: row.nickname, accountId: row.accountId, role: row.consoleRole || undefined });
                setConflict(false);
                setError(undefined);
              } else if (result.isSuccess) {
                setSelected(null);
                form.resetFields();
                setConflict(false);
                setError(undefined);
                message.info("该账号已不在当前列表，请重新搜索并选择");
              }
            }}
          >
            刷新管理员资料后重新确认
          </Button>
        )}
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="nickname" label="昵称" rules={[{required:true,whitespace:true},{max:50}]}><Input maxLength={50} disabled={busy}/></Form.Item>
          <Form.Item name="accountId" label="登录账号" validateStatus={availability.status === "taken" || availability.status === "error" ? "error" : availability.status === "checking" ? "validating" : availability.status === "available" ? "success" : undefined} help={availability.help} rules={[{required:true},{transform:value=>typeof value === "string" ? value.trim() : value,pattern:/^[a-zA-Z0-9_-]{4,32}$/,message:"账号需为 4–32 位字母、数字、下划线或短横线"}]}><Input maxLength={32} disabled={busy}/></Form.Item>
          {availability.status === "error" && <Button type="link" size="small" onClick={availability.retry}>重新检查账号</Button>}
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select
              disabled={busy || selected?.id === (me.data?.userId || me.data?.id)}
              options={roles.map((value) => ({
                value,
                label: displayLabel("consoleRole", value),
              }))}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="修改原因"
            rules={[{ required: true, whitespace: true, min: 2, max: 500 }]}
          >
            <Input.TextArea maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
