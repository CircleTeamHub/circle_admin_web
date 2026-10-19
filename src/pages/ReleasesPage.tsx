import { UpdateDecisionSummary } from "../components/UpdateDecisionSummary";
import { CodeValue } from "../components/ReadableValue";
import { displayLabel } from "../utils/display";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  consoleApi,
  consoleWrite,
  type Plan,
  type Release,
} from "../api/console";
import { PageError } from "../components/PageError";
import { ReasonAction, useConsoleFilters } from "./console-shared";
import { formatDateTime } from "../utils/format";

function planBody(plan: Plan) {
  return {
    releaseID: plan.releaseID,
    rollout: plan.rollout,
    minBuild: plan.minBuild,
    maxBuild: plan.maxBuild,
    forceBelow: plan.forceBelow,
    startsAt: plan.startsAt,
    endsAt: plan.endsAt,
    enabled: plan.enabled,
    version: plan.version,
  };
}
export function ReleasesPage() {
  const { search, set } = useConsoleFilters(),
    client = useQueryClient();
  const query = useQuery({
    queryKey: ["console", "releases"],
    queryFn: consoleApi.releases,
  });
  const [editing, setEditing] = useState<{
      kind: "release" | "plan";
      plan?: Plan;
    } | null>(null),
    [form] = Form.useForm(),
    [previewForm] = Form.useForm();
  const [preview, setPreview] = useState<URLSearchParams | null>(() =>
    search.get("installationID")
      ? new URLSearchParams({
          platform: search.get("platform") ?? "android",
          channel: search.get("channel") ?? "stable",
          build: search.get("build") ?? "0",
          installation: "local-preview-device",
          installationID: search.get("installationID")!,
        })
      : null,
  );
  const decision = useQuery({
    queryKey: ["console", "release-preview", preview?.toString()],
    queryFn: () => consoleApi.preview(preview!),
    enabled: !!preview,
    staleTime: 0,
  });
  const command = useRef<{ fingerprint: string; key: string } | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      if (editing?.kind === "plan") {
        values.startsAt = new Date(values.startsAt + "Z").toISOString();
        values.endsAt = new Date(values.endsAt + "Z").toISOString();
        if (editing.plan) values.version = editing.plan.version;
      }
      const path =
          editing?.kind === "release"
            ? "/admin/console/releases"
            : editing?.plan
              ? `/admin/console/release-plans/${editing.plan.id}`
              : "/admin/console/release-plans",
        method = editing?.plan ? "PATCH" : "POST";
      const fingerprint = JSON.stringify({ path, values, method });
      if (command.current?.fingerprint !== fingerprint)
        command.current = { fingerprint, key: crypto.randomUUID() };
      return consoleWrite(path, values, command.current.key, method);
    },
    onSuccess: () => {
      command.current = null;
      setEditing(null);
      form.resetFields();
      void client.invalidateQueries({ queryKey: ["console", "releases"] });
      void client.invalidateQueries({
        queryKey: ["console", "release-preview"],
      });
    },
  });
  function edit(kind: "release" | "plan", plan?: Plan) {
    form.resetFields();
    save.reset();
    setEditing({ kind, plan });
    form.setFieldsValue(
      plan
        ? {
            ...planBody(plan),
            startsAt: new Date(plan.startsAt).toISOString().slice(0, 16),
            endsAt: new Date(plan.endsAt).toISOString().slice(0, 16),
          }
        : kind === "release"
          ? { platform: "android", channel: "stable", notes: "" }
          : {
              rollout: 10,
              minBuild: 0,
              maxBuild: 0,
              forceBelow: 0,
              enabled: true,
              startsAt: new Date().toISOString().slice(0, 16),
              endsAt: new Date(Date.now() + 30 * 86400_000)
                .toISOString()
                .slice(0, 16),
            },
    );
  }
  const tab = ["releases", "plans", "versions", "preview"].includes(
    search.get("tab") ?? "",
  )
    ? search.get("tab")!
    : "releases";
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <Space>
        <Typography.Title level={3}>App 版本与更新计划</Typography.Title>
        <Button onClick={() => edit("release")}>登记已发布版本</Button>
        <Button type="primary" onClick={() => edit("plan")}>
          新建灰度计划
        </Button>
      </Space>
      <Alert
        type="info"
        title="先由发布流程生成官方安装包，再登记版本并配置更新计划。这里只管理推荐与强制更新决策，不执行构建或上传。灰度按安装实例稳定分桶。"
      />
      {query.isError && (
        <PageError error={query.error} onRetry={() => void query.refetch()} />
      )}
      <Tabs
        activeKey={tab}
        onChange={(v) => set({ tab: v })}
        items={[
          {
            key: "releases",
            label: "已发布版本",
            children: (
              <Table<Release>
                rowKey="id"
                dataSource={query.data?.releases}
                loading={query.isFetching}
                scroll={{ x: 900 }}
                columns={[
                  { title: "版本", dataIndex: "version" },
                  { title: "构建号", dataIndex: "build" },
                  {
                    title: "平台",
                    dataIndex: "platform",
                    render: (value: string | null) => (
                      <CodeValue domain="platform" value={value} />
                    ),
                  },
                  {
                    title: "渠道",
                    dataIndex: "channel",
                    render: (value: string | null) => (
                      <CodeValue domain="channel" value={value} />
                    ),
                  },
                  {
                    title: "状态",
                    render: (_, r) => (
                      <Tag color={r.withdrawnAt ? "red" : "green"}>
                        {r.withdrawnAt ? "已撤回" : "可配置"}
                      </Tag>
                    ),
                  },
                  {
                    title: "登记时间",
                    dataIndex: "createdAt",
                    render: formatDateTime,
                  },
                  {
                    title: "操作",
                    render: (_, r) =>
                      !r.withdrawnAt ? (
                        <ReasonAction
                          title="撤回版本"
                          path={`/admin/console/releases/${r.id}/withdraw`}
                          payload={{}}
                          danger
                          confirmText={r.version}
                          onDone={() => { if (preview) void decision.refetch(); }}
                        />
                      ) : null,
                  },
                ]}
              />
            ),
          },
          {
            key: "plans",
            label: "更新计划",
            children: (
              <Table<Plan>
                rowKey="id"
                dataSource={query.data?.plans}
                scroll={{ x: 1100 }}
                columns={[
                  {
                    title: "目标版本",
                    render: (_, p) =>
                      `${displayLabel("platform", p.release.platform)} ${p.release.version}`,
                  },
                  {
                    title: "灰度",
                    dataIndex: "rollout",
                    render: (v: number) => `${v}%`,
                  },
                  {
                    title: "来源构建范围",
                    render: (_, p) => `${p.minBuild}–${p.maxBuild}`,
                  },
                  { title: "强制更新阈值", dataIndex: "forceBelow" },
                  {
                    title: "开始时间",
                    dataIndex: "startsAt",
                    render: formatDateTime,
                  },
                  {
                    title: "结束时间",
                    dataIndex: "endsAt",
                    render: formatDateTime,
                  },
                  {
                    title: "启用",
                    dataIndex: "enabled",
                    render: (v: boolean) => (v ? "是" : "否"),
                  },
                  {
                    title: "操作",
                    render: (_, p) => (
                      <Space>
                        <Button onClick={() => edit("plan", p)}>编辑</Button>
                        <ReasonAction
                          title={p.enabled ? "停用" : "启用"}
                          path={`/admin/console/release-plans/${p.id}`}
                          method="PATCH"
                          payload={{ ...planBody(p), enabled: !p.enabled }}
                        />
                      </Space>
                    ),
                  },
                ]}
              />
            ),
          },
          {
            key: "versions",
            label: "版本分布",
            children: (
              <Card title="最近 30 天活跃的账号设备登记（同一设备切换账号可能重复）">
                <Table
                  rowKey={(r) => `${r.platform}:${r.channel}:${r.build}`}
                  dataSource={query.data?.versions}
                  columns={[
                    {
                      title: "平台",
                      dataIndex: "platform",
                      render: (value: string | null) => (
                        <CodeValue domain="platform" value={value} />
                      ),
                    },
                    {
                      title: "渠道",
                      dataIndex: "channel",
                      render: (value: string | null) => (
                        <CodeValue domain="channel" value={value} />
                      ),
                    },
                    { title: "版本", dataIndex: "appVersion" },
                    { title: "构建号", dataIndex: "build" },
                    { title: "活跃登记数", dataIndex: "_count" },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "preview",
            label: "决策预览",
            children: (
              <Card title="检查指定客户端会收到什么更新">
                <Form
                  form={previewForm}
                  layout="inline"
                  initialValues={{
                    platform: search.get("platform") ?? "android",
                    channel: search.get("channel") ?? "stable",
                    build: Number(search.get("build") ?? 1000000),
                    installationID: search.get("installationID") ?? undefined,
                    installation: "local-preview-device",
                  }}
                  onFinish={(v) =>
                    setPreview(
                      new URLSearchParams(
                        Object.entries(v)
                          .filter(
                            ([, value]) => value !== undefined && value !== "",
                          )
                          .map(([k, value]) => [k, String(value)]),
                      ),
                    )
                  }
                >
                  <Form.Item name="platform">
                    <Select
                      style={{ width: 110 }}
                      options={["android", "ios"].map((value) => ({
                        value,
                        label: displayLabel("platform", value),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="channel">
                    <Select
                      style={{ width: 110 }}
                      options={["stable", "beta"].map((value) => ({
                        value,
                        label: displayLabel("channel", value),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name="build" rules={[{ required: true }]}>
                    <InputNumber aria-label="当前构建号" min={0} />
                  </Form.Item>
                  <Form.Item
                    name="installation"
                    rules={[{ required: true, min: 16, max: 128 }]}
                  >
                    <Input
                      aria-label="安装实例标识"
                      placeholder="用于稳定分桶的安装标识"
                    />
                  </Form.Item>
                  <Form.Item
                    name="installationID"
                    label="已登记设备 ID（可选）"
                  >
                    <Input placeholder="使用最近上报的真实版本与分桶" />
                  </Form.Item>
                  <Button htmlType="submit">预览决策</Button>
                </Form>
                {decision.isError && <PageError error={decision.error} />}
                {decision.data ? (
                  <UpdateDecisionSummary decision={decision.data} />
                ) : (
                  <Typography.Paragraph>提交后显示结果</Typography.Paragraph>
                )}
              </Card>
            ),
          },
        ]}
      />
      <Modal
        width={680}
        title={editing?.kind === "release" ? "登记官方版本" : "配置更新计划"}
        open={!!editing}
        onCancel={() => !save.isPending && setEditing(null)}
        onOk={() => save.mutate()}
        confirmLoading={save.isPending}
        cancelButtonProps={{ disabled: save.isPending }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {editing?.kind === "release" ? (
            <>
              <Form.Item
                name="platform"
                label="平台"
                rules={[{ required: true }]}
              >
                <Select
                  options={["android", "ios"].map((value) => ({
                    value,
                    label: displayLabel("platform", value),
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="channel"
                label="渠道"
                rules={[{ required: true }]}
              >
                <Select
                  options={["stable", "beta"].map((value) => ({
                    value,
                    label: displayLabel("channel", value),
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="version"
                label="版本（如 1.2.3）"
                rules={[{ required: true, pattern: /^\d+\.\d+\.\d+$/ }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="build"
                label="构建号（Android：主版本×1000000＋次版本×1000＋补丁）"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item
                name="url"
                label="官方 APK / App Store HTTPS 地址"
                rules={[{ required: true, type: "url" }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="sha256"
                label="发布工件 SHA-256"
                rules={[{ required: true, pattern: /^[a-f0-9]{64}$/i }]}
              >
                <Input />
              </Form.Item>
              <Form.Item
                name="sizeBytes"
                label="工件大小（字节）"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} />
              </Form.Item>
              <Form.Item name="notes" label="更新说明">
                <Input.TextArea maxLength={3000} />
              </Form.Item>
            </>
          ) : (
            <>
              <Form.Item
                name="releaseID"
                label="目标版本"
                rules={[{ required: true }]}
              >
                <Select
                  options={query.data?.releases
                    .filter((r) => !r.withdrawnAt)
                    .map((r) => ({
                      value: r.id,
                      label: `${displayLabel("platform", r.platform)} ${displayLabel("channel", r.channel)} ${r.version} (${r.build})`,
                    }))}
                />
              </Form.Item>
              {[
                ["rollout", "灰度百分比"],
                ["minBuild", "最低来源构建号"],
                ["maxBuild", "最高来源构建号（必须低于目标）"],
                ["forceBelow", "低于此构建号必须更新（0 表示不强制）"],
              ].map(([name, label]) => (
                <Form.Item
                  key={name}
                  name={name}
                  label={label}
                  rules={[{ required: true }]}
                >
                  <InputNumber
                    min={0}
                    max={name === "rollout" ? 100 : 2147483647}
                  />
                </Form.Item>
              ))}
              <Form.Item
                name="startsAt"
                label="开始时间（UTC）"
                rules={[{ required: true }]}
              >
                <Input type="datetime-local" />
              </Form.Item>
              <Form.Item
                name="endsAt"
                label="结束时间（UTC）"
                rules={[{ required: true }]}
              >
                <Input type="datetime-local" />
              </Form.Item>
              <Form.Item
                name="enabled"
                label="启用计划"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </>
          )}
          <Form.Item
            name="reason"
            label="操作原因"
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea />
          </Form.Item>
        </Form>
        {save.isError && <PageError error={save.error} />}
      </Modal>
    </Space>
  );
}
