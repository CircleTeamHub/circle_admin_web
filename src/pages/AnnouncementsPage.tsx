import { PageHeader } from "../components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Checkbox,
  Switch,
  Table,
  Button,
  Form,
  Input,
  Modal,
  Space,
  Typography,
  message,
} from "antd";
import { useRef, useState } from "react";
import { editAnnouncement, deleteAnnouncement, type AdminAnnouncement, listAnnouncements, setAnnouncementScrolling, publishAnnouncement } from "../api/moderation";
import { getErrorMessage } from "../utils/errors";
import { getSession, getSessionEpoch } from "../auth/session";

const PENDING_KEY = "circle-admin-pending-announcement";
type PendingAnnouncement = { key: string; digest: string };
type AnnouncementAttempt = PendingAnnouncement & {
  title: string;
  scrolling: boolean;
  content: string;
  storageKey: string;
  sessionEpoch: number;
};
function readPending(storageKey: string): PendingAnnouncement | undefined {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return undefined;
  const value = JSON.parse(raw) as PendingAnnouncement;
  if (
    !/^[0-9a-f-]{36}$/i.test(value.key) ||
    !/^[0-9a-f]{64}$/i.test(value.digest)
  )
    throw new Error("待确认公告记录无效，请联系管理员核对发布结果");
  return value;
}
async function contentDigest(content: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function AnnouncementsPage() {
  const [form] = Form.useForm<{ title: string; content: string; scrolling: boolean }>();
  const [preview, setPreview] = useState<{ title: string; content: string; scrolling: boolean }>();
  const [result, setResult] = useState<number>();
  const attempt = useRef<AnnouncementAttempt | undefined>(undefined);
  const preparing = useRef(false);
  const [preparingPreview, setPreparingPreview] = useState(false);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ title, content, scrolling, key, sessionEpoch }: AnnouncementAttempt) => {
      if (getSessionEpoch() !== sessionEpoch)
        throw new Error("登录状态已变更，请重试");
      return publishAnnouncement(content, key, title, scrolling);
    },
    onSuccess: (response, variables) => {
      try {
        for (const storageKey of [variables.storageKey, PENDING_KEY]) {
          const pending = readPending(storageKey);
          if (
            pending?.key === variables.key &&
            pending.digest === variables.digest
          )
            sessionStorage.removeItem(storageKey);
        }
      } catch {
        if (getSessionEpoch() === variables.sessionEpoch)
          message.warning("公告已发布，但待确认记录清理失败，请联系管理员");
      }
      if (getSessionEpoch() !== variables.sessionEpoch) return;
      void queryClient.invalidateQueries({queryKey:["admin-announcements"]});
      setResult(response.createdCount);
      setPreview(undefined);
      form.resetFields();
      attempt.current = undefined;
    },
    onError: (error, variables) => {
      if (getSessionEpoch() !== variables.sessionEpoch) return;
      message.error(
        getErrorMessage(error, "发布失败；再次确认会使用同一个请求标识重试"),
      );
    },
  });
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <PageHeader title="系统公告" description="发布前先预览内容；已发布的公告可在下方查看。" />
      <Typography.Paragraph>
        公告发送给活跃用户。返回数量表示创建的站内通知数量。
      </Typography.Paragraph>
      {result !== undefined && (
        <Alert type="success" message={`已创建 ${result} 条站内通知`} />
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={{scrolling:false}}
        onFinish={({ title, content, scrolling }) => {
          setPreview({ title: title.trim(), content: content.trim(), scrolling: Boolean(scrolling) });
        }}
      >
        <Form.Item name="title" label="公告标题" rules={[{ required: true, whitespace: true }, { max: 100 }]}>
          <Input maxLength={100} showCount placeholder="填写简明的公告标题" disabled={mutation.isPending || !!attempt.current} />
        </Form.Item>
        <Form.Item
          name="content"
          label="公告正文"
          rules={[{ required: true, whitespace: true }, { max: 5000 }]}
        >
          <Input.TextArea
            rows={10}
            maxLength={5000}
            showCount
            disabled={mutation.isPending || !!attempt.current}
          />
        </Form.Item>
        <Form.Item name="scrolling" valuePropName="checked">
          <Checkbox disabled={mutation.isPending || !!attempt.current}>在 App 个人中心滚动播报此公告</Checkbox>
        </Form.Item>
        <Typography.Paragraph type="secondary">
          发布失败后保留请求标识。返回此页面或刷新后，请重新输入完全相同的标题、正文和播报选项重试；待确认结果核对前无法发布不同内容。
        </Typography.Paragraph>
        <Button
          type="primary"
          htmlType="submit"
          disabled={mutation.isPending || preparingPreview}
        >
          预览并确认
        </Button>
      </Form>
      <Modal
        title="确认向活跃用户发布公告"
        open={preview !== undefined}
        confirmLoading={mutation.isPending || preparingPreview}
        onCancel={() => {
          if (!mutation.isPending && !preparing.current) setPreview(undefined);
        }}
        onOk={async () => {
          if (!preview || mutation.isPending || preparing.current) return;
          if (attempt.current && (attempt.current.content !== preview.content || attempt.current.title !== preview.title || attempt.current.scrolling !== preview.scrolling)) {
            message.error("上次发布结果尚未确认，请先使用原标题和正文重试以核对结果");
            return;
          }
          preparing.current = true;
          setPreparingPreview(true);
          const sessionEpoch = getSessionEpoch();
          try {
            const tokenPart = getSession()?.accessToken.split(".")[1];
            if (!tokenPart) throw new Error("请重新登录后发布");
            const payload = JSON.parse(
              atob(tokenPart.replace(/-/g, "+").replace(/_/g, "/")),
            ) as { sub?: string };
            if (typeof payload.sub !== "string" || !payload.sub)
              throw new Error("无法确认发布账号，请重新登录");
            const [actorDigest, digest] = await Promise.all([
              contentDigest(
                JSON.stringify(["announcement-actor", payload.sub]),
              ),
              contentDigest(JSON.stringify([payload.sub, preview.title, preview.content, preview.scrolling])),
            ]);
            if (getSessionEpoch() !== sessionEpoch)
              throw new Error("登录状态已变更，请重试");
            const storageKey = `${PENDING_KEY}:${actorDigest}`;
            const pending = readPending(storageKey);
            if (pending && pending.digest !== digest) {
              message.error("还有待确认的公告，请输入上次完全相同的标题、正文和播报选项重试");
              return;
            }
            // Preserve the old global record for its original actor/content.
            // Another actor's mismatching digest must not block their own attempt.
            const legacy = readPending(PENDING_KEY);
            const matchingLegacy =
              legacy?.digest === digest ? legacy : undefined;
            if (pending && matchingLegacy && pending.key !== matchingLegacy.key)
              throw new Error(
                "存在多个待确认发布标识，请联系管理员核对发布结果",
              );
            const key =
              pending?.key ?? matchingLegacy?.key ?? crypto.randomUUID();
            // Persist only retry identity and a digest, never the announcement body.
            sessionStorage.setItem(storageKey, JSON.stringify({ key, digest }));
            attempt.current = {
              title: preview.title,
              scrolling: preview.scrolling,
              content: preview.content,
              key,
              digest,
              storageKey,
              sessionEpoch,
            };
            mutation.mutate(attempt.current);
          } catch (error) {
            if (getSessionEpoch() !== sessionEpoch) return;
            message.error(
              getErrorMessage(error, "无法安全保存发布标识，公告尚未发送"),
            );
          } finally {
            preparing.current = false;
            setPreparingPreview(false);
          }
        }}
      >
        <Typography.Paragraph type="secondary">滚动播报：{preview?.scrolling ? "开启" : "关闭"}</Typography.Paragraph>
        <Typography.Title level={4}>{preview?.title}</Typography.Title>
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {preview?.content}
        </Typography.Paragraph>
      </Modal>
      <AnnouncementScrollingSettings />
    </Space>
  );
}

function AnnouncementScrollingSettings() {
  const client = useQueryClient();
  const query = useQuery({queryKey:["admin-announcements"],queryFn:listAnnouncements});
  const [editing, setEditing] = useState<AdminAnnouncement>();
  const [deleting, setDeleting] = useState<AdminAnnouncement>();
  const [editForm] = Form.useForm<{title:string;content:string}>();
  const refresh = () => { void client.invalidateQueries({queryKey:["admin-announcements"]}); };
  const toggle = useMutation({
    mutationFn:({id, scrolling}:{id:string;scrolling:boolean}) => setAnnouncementScrolling(id,scrolling),
    onSuccess:()=>{refresh();message.success("播报设置已更新");},
    onError:(error)=>{message.error(getErrorMessage(error,"设置失败，请重试"));refresh();},
  });
  const edit = useMutation({
    mutationFn:({id,title,content}:{id:string;title:string;content:string})=>editAnnouncement(id,{title,content}),
    onSuccess:()=>{refresh();setEditing(undefined);editForm.resetFields();message.success("公告已更新");},
    onError:(error)=>{refresh();message.error(getErrorMessage(error,"保存失败，请重试"));},
  });
  const remove = useMutation({
    mutationFn:deleteAnnouncement,
    onSuccess:()=>{refresh();setDeleting(undefined);message.success("公告已删除并停止播报");},
    onError:(error)=>{refresh();message.error(getErrorMessage(error,"删除失败，请重试"));},
  });
  const busy = toggle.isPending || edit.isPending || remove.isPending;
  return <>
    <Typography.Title level={4}>已发布公告</Typography.Title>
    <Typography.Paragraph type="secondary">一次只能播报一条公告。开启新公告会自动停止上一条；关闭播报不会删除通知。在线 App 会立即同步；离线后重新连接时自动更新。</Typography.Paragraph>
    {query.isError && <Alert type="error" message="公告列表加载失败" action={<Button onClick={()=>query.refetch()}>重试</Button>} />}
    <Table rowKey="id" loading={query.isPending} dataSource={query.data?.items ?? []} scroll={{x:850}} pagination={{pageSize:10}} columns={[
      {title:"公告标题 / 正文",render:(_,row)=><><Typography.Text strong>{row.title || "系统通知"}</Typography.Text><Typography.Paragraph ellipsis={{rows:2,expandable:true,symbol:"展开"}} style={{marginBottom:0}}>{row.content}</Typography.Paragraph></>},
      {title:"发布时间",width:180,render:(_,row)=>new Date(row.createdAt).toLocaleString("zh-CN",{hour12:false})},
      {title:"滚动播报",width:110,render:(_,row)=><Switch aria-label={`${row.title || "系统通知"}的滚动播报`} checked={row.scrolling} checkedChildren="开启" unCheckedChildren="关闭" loading={toggle.isPending && toggle.variables?.id===row.id} disabled={busy || !row.fanoutCompletedAt} onChange={scrolling=>toggle.mutate({id:row.id,scrolling})} />},
      {title:"操作",width:130,fixed:"right",render:(_,row)=><Space size={0} wrap>
        <Button type="link" size="small" disabled={busy || !row.fanoutCompletedAt} onClick={()=>{setEditing(row);editForm.setFieldsValue({title:row.title || "",content:row.content});}}>编辑</Button>
        <Button type="text" size="small" danger disabled={busy || !row.fanoutCompletedAt} onClick={()=>setDeleting(row)}>删除</Button>
      </Space>},
    ]} />
    <Modal title="编辑公告" open={!!editing} confirmLoading={edit.isPending} okText="保存修改" cancelText="取消" onCancel={()=>{if(!edit.isPending)setEditing(undefined);}} onOk={async()=>{
      if(!editing || edit.isPending)return;
      const values=await editForm.validateFields();edit.mutate({id:editing.id,title:values.title.trim(),content:values.content.trim()});
    }}>
      <Typography.Paragraph type="secondary">修改同步到 App 内的公告和滚动横幅，不重复发送手机推送；已送达手机通知栏的内容不会更新。</Typography.Paragraph>
      <Form name="edit-announcement" form={editForm} layout="vertical">
        <Form.Item name="title" label="标题" rules={[{required:true,whitespace:true},{max:100}]}><Input maxLength={100} showCount disabled={edit.isPending} /></Form.Item>
        <Form.Item name="content" label="正文" rules={[{required:true,whitespace:true},{max:5000}]}><Input.TextArea rows={8} maxLength={5000} showCount disabled={edit.isPending} /></Form.Item>
      </Form>
    </Modal>
    <Modal title="确认删除公告" open={!!deleting} confirmLoading={remove.isPending} okText="删除公告" okButtonProps={{danger:true}} cancelText="取消" onCancel={()=>{if(!remove.isPending)setDeleting(undefined);}} onOk={()=>{if(deleting && !remove.isPending)remove.mutate(deleting.id);}}>
      <Typography.Text strong>{deleting?.title || "系统通知"}</Typography.Text>
      <Typography.Paragraph>删除后，公告会从 App 站内列表和滚动横幅移除，尚未投递的推送会停止。已经送达或正在投递到手机通知栏的推送无法收回。</Typography.Paragraph>
    </Modal>
  </>;
}
