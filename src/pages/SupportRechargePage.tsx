import {
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { UploadFile } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useState } from "react";
import {
  approveSupportRechargeOrder,
  createSupportRechargePaymentCode,
  listSupportRechargeOrders,
  listSupportRechargePaymentCodes,
  rejectSupportRechargeOrder,
  setSupportRechargePaymentCodeEnabled,
  updateSupportRechargePaymentCode,
  uploadSupportRechargeImage,
  type ApproveSupportRechargeOrderPayload,
  type RechargeFulfillmentType,
  type RechargeOrderStatus,
  type SupportRechargeOrder,
  type SupportRechargePaymentCode,
} from "../api/support-recharge";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";

const PAYMENT_CODES_KEY = ["supportRechargePaymentCodes"] as const;
const ORDERS_KEY = ["supportRechargeOrders"] as const;

const STATUS_LABELS: Record<RechargeOrderStatus, string> = {
  AWAITING_PROOF: "等待付款截图",
  WAITING_REVIEW: "待审核",
  PROCESSING: "发放处理中",
  APPROVED: "已完成",
  REJECTED: "已驳回",
};

const STATUS_COLORS: Record<RechargeOrderStatus, string> = {
  AWAITING_PROOF: "default",
  WAITING_REVIEW: "orange",
  PROCESSING: "blue",
  APPROVED: "green",
  REJECTED: "red",
};

const REQUEST_LABELS = {
  GENERAL: "充值咨询",
  COIN: "积分",
  MEMBERSHIP: "会员",
} as const;

type PaymentCodeForm = {
  label: string;
  validFrom: string;
  validUntil?: string;
  fileList: UploadFile[];
};

type ApprovalForm = {
  paymentTransactionId: string;
  fulfillmentType: RechargeFulfillmentType;
  coinAmount?: number;
  membershipLevel?: number;
  note?: string;
};

function toIso(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toLocalDateTimeInput(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function SupportRechargePage() {
  const queryClient = useQueryClient();
  const [codeForm] = Form.useForm<PaymentCodeForm>();
  const [approvalForm] = Form.useForm<ApprovalForm>();
  const [rejectForm] = Form.useForm<{ reason: string }>();
  const [codeOpen, setCodeOpen] = useState(false);
  const [editingCode, setEditingCode] =
    useState<SupportRechargePaymentCode | null>(null);
  const [approving, setApproving] = useState<SupportRechargeOrder | null>(null);
  const [rejecting, setRejecting] = useState<SupportRechargeOrder | null>(null);
  const [status, setStatus] = useState<RechargeOrderStatus>("WAITING_REVIEW");
  const fulfillmentType = Form.useWatch("fulfillmentType", approvalForm);

  const paymentCodes = useQuery({
    queryKey: PAYMENT_CODES_KEY,
    queryFn: listSupportRechargePaymentCodes,
  });
  const orders = useQuery({
    queryKey: [...ORDERS_KEY, status],
    queryFn: () => listSupportRechargeOrders(status),
  });
  const refreshCodes = () =>
    queryClient.invalidateQueries({ queryKey: PAYMENT_CODES_KEY });
  const refreshOrders = () =>
    queryClient.invalidateQueries({ queryKey: ORDERS_KEY });

  const saveCode = useMutation({
    mutationFn: async (values: PaymentCodeForm) => {
      const file = values.fileList[0]?.originFileObj;
      const validFrom = toIso(values.validFrom);
      if (!validFrom) throw new Error("请选择正确的生效时间");
      const objectKey = file
        ? await uploadSupportRechargeImage(file)
        : undefined;
      if (editingCode) {
        return updateSupportRechargePaymentCode(editingCode.id, {
          label: values.label.trim(),
          validFrom,
          validUntil: toIso(values.validUntil),
          ...(objectKey ? { objectKey } : {}),
        });
      }
      if (!objectKey) throw new Error("请选择收款码图片");
      return createSupportRechargePaymentCode({
        label: values.label.trim(),
        objectKey,
        validFrom,
        validUntil: toIso(values.validUntil),
      });
    },
    onSuccess: () => {
      message.success(editingCode ? "收款码已更新" : "收款码已添加");
      setCodeOpen(false);
      setEditingCode(null);
      codeForm.resetFields();
    },
    onError: (error) =>
      message.error(getErrorMessage(error, "保存收款码失败")),
    onSettled: refreshCodes,
  });

  const toggleCode = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setSupportRechargePaymentCodeEnabled(id, enabled),
    onSuccess: () => message.success("收款码状态已更新"),
    onError: (error) => message.error(getErrorMessage(error, "更新失败")),
    onSettled: refreshCodes,
  });

  const approve = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ApproveSupportRechargeOrderPayload;
    }) => approveSupportRechargeOrder(id, payload),
    onSuccess: () => {
      message.success("充值已核对并完成发放");
      setApproving(null);
      approvalForm.resetFields();
    },
    onError: (error) => message.error(getErrorMessage(error, "审核发放失败")),
    onSettled: refreshOrders,
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectSupportRechargeOrder(id, reason),
    onSuccess: () => {
      message.success("申请已驳回并通知用户");
      setRejecting(null);
      rejectForm.resetFields();
    },
    onError: (error) => message.error(getErrorMessage(error, "驳回失败")),
    onSettled: refreshOrders,
  });

  const codeColumns: ColumnsType<SupportRechargePaymentCode> = [
    {
      title: "图片",
      width: 96,
      render: (_, row) =>
        row.previewUrl ? (
          <Image src={row.previewUrl} width={56} height={56} />
        ) : (
          "-"
        ),
    },
    { title: "说明", dataIndex: "label" },
    {
      title: "有效期",
      render: (_, row) =>
        `${formatDateTime(row.validFrom)} 至 ${formatDateTime(row.validUntil)}`,
    },
    {
      title: "启用",
      width: 90,
      render: (_, row) => (
        <Switch
          checked={row.enabled}
          loading={toggleCode.isPending && toggleCode.variables?.id === row.id}
          onChange={(enabled) => toggleCode.mutate({ id: row.id, enabled })}
        />
      ),
    },
    {
      title: "操作",
      width: 110,
      render: (_, row) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditingCode(row);
            codeForm.setFieldsValue({
              label: row.label,
              validFrom: toLocalDateTimeInput(row.validFrom),
              validUntil: row.validUntil
                ? toLocalDateTimeInput(row.validUntil)
                : undefined,
              fileList: [],
            });
            setCodeOpen(true);
          }}
        >
          编辑/换图
        </Button>
      ),
    },
  ];

  const orderColumns: ColumnsType<SupportRechargeOrder> = [
    {
      title: "申请",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Typography.Text copyable>{row.orderNo}</Typography.Text>
          <Typography.Text type="secondary">
            {REQUEST_LABELS[row.requestKind]}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "用户",
      render: (_, row) =>
        row.user ? `${row.user.nickname} (${row.user.accountId})` : row.userID,
    },
    {
      title: "付款记录",
      width: 110,
      render: (_, row) =>
        row.evidenceUrl ? <Image src={row.evidenceUrl} width={72} /> : "未提交",
    },
    {
      title: "提交时间",
      render: (_, row) => formatDateTime(row.submittedAt ?? row.createdAt),
    },
    {
      title: "状态",
      render: (_, row) => (
        <Tag color={STATUS_COLORS[row.status]}>{STATUS_LABELS[row.status]}</Tag>
      ),
    },
    {
      title: "操作",
      width: 190,
      render: (_, row) =>
        row.status === "WAITING_REVIEW" || row.status === "PROCESSING" ? (
          <Space>
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                setApproving(row);
                const existing = row.fulfillmentPayload;
                approvalForm.setFieldsValue(
                  existing
                    ? {
                        ...existing,
                        note: existing.note ?? undefined,
                      }
                    : {
                        fulfillmentType:
                          row.requestKind === "COIN"
                            ? "COIN"
                            : row.requestKind === "MEMBERSHIP"
                              ? "MEMBERSHIP"
                              : undefined,
                      },
                );
              }}
            >
              {row.status === "PROCESSING" ? "继续发放" : "核对并发放"}
            </Button>
            {row.status === "WAITING_REVIEW" ? (
              <Button
                danger
                size="small"
                icon={<StopOutlined />}
                onClick={() => setRejecting(row)}
              >
                驳回
              </Button>
            ) : null}
          </Space>
        ) : row.paymentTransactionID ? (
          <Typography.Text copyable>{row.paymentTransactionID}</Typography.Text>
        ) : (
          "-"
        ),
    },
  ];

  const submitApproval = async () => {
    if (!approving) return;
    const values = await approvalForm.validateFields();
    approve.mutate({
      id: approving.id,
      payload: {
        fulfillmentType: values.fulfillmentType,
        paymentTransactionId: values.paymentTransactionId.trim(),
        ...(values.fulfillmentType === "COIN"
          ? { coinAmount: values.coinAmount }
          : {}),
        ...(values.fulfillmentType === "MEMBERSHIP"
          ? { membershipLevel: values.membershipLevel }
          : {}),
        note: values.note?.trim() || undefined,
      },
    });
  };

  return (
    <Space direction="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Typography.Title level={2}>充值客服</Typography.Title>
        <Typography.Paragraph type="secondary">
          自动客服只负责发送当前收款码并收集付款截图。付款真实性必须由管理员核对，确认后才会发放积分或开通会员。
        </Typography.Paragraph>
      </div>

      <Card
        title="收款码配置"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingCode(null);
              codeForm.resetFields();
              setCodeOpen(true);
              codeForm.setFieldsValue({
                validFrom: toLocalDateTimeInput(new Date()),
                fileList: [],
              });
            }}
          >
            新增收款码
          </Button>
        }
      >
        {paymentCodes.isError ? (
          <PageError
            error={paymentCodes.error}
            onRetry={() => paymentCodes.refetch()}
            message="收款码加载失败"
          />
        ) : null}
        <Table
          rowKey="id"
          columns={codeColumns}
          dataSource={paymentCodes.data ?? []}
          loading={paymentCodes.isLoading}
          pagination={false}
        />
      </Card>

      <Card
        title="充值申请"
        extra={
          <Space>
            <Select
              value={status}
              onChange={setStatus}
              style={{ width: 150 }}
              options={Object.entries(STATUS_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            <Button icon={<ReloadOutlined />} onClick={() => orders.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        {orders.isError ? (
          <PageError
            error={orders.error}
            onRetry={() => orders.refetch()}
            message="充值申请加载失败"
          />
        ) : null}
        <Table
          rowKey="id"
          columns={orderColumns}
          dataSource={orders.data ?? []}
          loading={orders.isLoading}
          scroll={{ x: 980 }}
        />
      </Card>

      <Modal
        title={editingCode ? "编辑收款码" : "新增收款码"}
        open={codeOpen}
        okText={editingCode ? "保存修改" : "上传并启用"}
        cancelText="取消"
        confirmLoading={saveCode.isPending}
        onCancel={() => {
          setCodeOpen(false);
          setEditingCode(null);
          codeForm.resetFields();
        }}
        onOk={() =>
          void codeForm
            .validateFields()
            .then((values) => saveCode.mutate(values))
        }
      >
        <Alert
          type="warning"
          showIcon
          message={
            editingCode
              ? "选择新图片即可替换；不选择则保留当前图片。修改只影响后续发送，不会改变历史聊天中的二维码。"
              : "请为收款码设置有效期；失效或停用后，机器人不会再向用户发送。"
          }
          style={{ marginBottom: 16 }}
        />
        <Form form={codeForm} layout="vertical">
          <Form.Item
            name="label"
            label="支付方式说明"
            rules={[
              { required: true, whitespace: true, message: "请输入说明" },
            ]}
          >
            <Input
              placeholder="例如：支付宝收款码（尾号 1234）"
              maxLength={80}
            />
          </Form.Item>
          <Form.Item
            name="fileList"
            label="收款码图片"
            valuePropName="fileList"
            getValueFromEvent={(event) => event?.fileList ?? []}
            rules={[
              {
                required: !editingCode,
                message: "请选择图片",
              },
            ]}
          >
            <Upload
              accept="image/jpeg,image/png,image/webp"
              maxCount={1}
              beforeUpload={() => false}
              listType="picture"
            >
              <Button>{editingCode ? "选择新图片" : "选择图片"}</Button>
            </Upload>
          </Form.Item>
          {editingCode?.previewUrl ? (
            <Form.Item label="当前图片">
              <Image src={editingCode.previewUrl} width={96} />
            </Form.Item>
          ) : null}
          <Form.Item
            name="validFrom"
            label="生效时间"
            rules={[{ required: true, message: "请选择生效时间" }]}
          >
            <Input type="datetime-local" />
          </Form.Item>
          <Form.Item name="validUntil" label="失效时间（可选）">
            <Input type="datetime-local" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`核对并发放 · ${approving?.orderNo ?? ""}`}
        open={!!approving}
        okText="确认付款并发放"
        cancelText="取消"
        confirmLoading={approve.isPending}
        onCancel={() => setApproving(null)}
        onOk={() => void submitApproval()}
      >
        <Alert
          type="warning"
          showIcon
          message="请先在支付平台核对交易号、付款人和金额。付款截图本身不能证明到账。"
          style={{ marginBottom: 16 }}
        />
        <Form form={approvalForm} layout="vertical">
          <Form.Item
            name="paymentTransactionId"
            label="支付平台交易号"
            rules={[
              { required: true, whitespace: true, message: "请输入真实交易号" },
            ]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item
            name="fulfillmentType"
            label="发放内容"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "COIN", label: "积分" },
                { value: "MEMBERSHIP", label: "会员" },
              ]}
            />
          </Form.Item>
          {fulfillmentType === "COIN" ? (
            <Form.Item
              name="coinAmount"
              label="积分数量"
              rules={[{ required: true, message: "请输入积分数量" }]}
            >
              <InputNumber min={1} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          {fulfillmentType === "MEMBERSHIP" ? (
            <Form.Item
              name="membershipLevel"
              label="会员等级"
              rules={[{ required: true, message: "请输入会员等级" }]}
            >
              <InputNumber
                min={1}
                max={4}
                precision={0}
                style={{ width: "100%" }}
              />
            </Form.Item>
          ) : null}
          <Form.Item name="note" label="审核备注（可选）">
            <Input.TextArea maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`驳回申请 · ${rejecting?.orderNo ?? ""}`}
        open={!!rejecting}
        okText="确认驳回"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        confirmLoading={reject.isPending}
        onCancel={() => setRejecting(null)}
        onOk={() =>
          void rejectForm
            .validateFields()
            .then(
              ({ reason }) =>
                rejecting &&
                reject.mutate({ id: rejecting.id, reason: reason.trim() }),
            )
        }
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="告知用户的原因"
            rules={[
              { required: true, whitespace: true, message: "请输入驳回原因" },
            ]}
          >
            <Input.TextArea
              maxLength={500}
              placeholder="例如：支付平台未查询到该交易，请重新核对后提交"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
