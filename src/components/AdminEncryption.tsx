import { displayLabel } from "../utils/display";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Alert, Button, Collapse, Input, Modal, Space, Typography } from "antd";
import { ProtocolDevice } from "@circle/e2ee";
import {
  EncryptionClient,
  type EncryptedContent,
  type PublicDevice,
} from "@circle/e2ee/relay-client.mjs";
import { openBrowserJournal } from "@circle/e2ee/browser-journal.mjs";
import { apiClient } from "../api/client";
import { getMe } from "../api/auth";
import { getSessionEpoch, subscribeSession } from "../auth/session";

const Context = createContext<EncryptionClient | null>(null);
export function AdminEncryption({ children }: { children: React.ReactNode }) {
  const [client, setClient] = useState<EncryptionClient | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [managedConversation, setManagedConversation] = useState("");
  const [archiveCount, setArchiveCount] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState<PublicDevice[]>([]);
  const journal = useRef<Awaited<ReturnType<typeof openBrowserJournal>> | null>(
    null,
  );
  const generation = useRef(0);
  const lock = useCallback(() => {
    generation.current++;
    setClient(null);
    setPassword("");
    setDevices([]);
    setRecoveryCode("");
    setEnteredCode("");
    setArchiveCount(undefined);
    const old = journal.current;
    journal.current = null;
    void old?.close();
  }, []);
  useEffect(() => {
    const epoch = getSessionEpoch();
    const unsubscribe = subscribeSession(() => {
      if (getSessionEpoch() !== epoch) lock();
    });
    const hide = () => {
      if (document.hidden) lock();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", hide);
      lock();
    };
  }, [lock]);
  const unlock = async () => {
    if (busy) return;
    const revision = ++generation.current;
    const epoch = getSessionEpoch();
    setBusy(true);
    setStatus("");
    const secret = password;
    setPassword("");
    let opened: Awaited<ReturnType<typeof openBrowserJournal>> | undefined;
    try {
      const user = await getMe();
      opened = await openBrowserJournal(user.id, secret);
      if (
        generation.current !== revision ||
        epoch !== getSessionEpoch() ||
        document.hidden
      ) {
        await opened.close();
        return;
      }
      const device = await ProtocolDevice.open(
        opened,
        user.id,
        opened.deviceId,
        new Map(),
      );
      const value = new EncryptionClient(
        device,
        async (path, method, body) => {
          if (generation.current !== revision || epoch !== getSessionEpoch())
            throw new Error("Vault locked");
          const result = await apiClient(path, {
            method,
            cache: "no-store",
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
          if (generation.current !== revision || epoch !== getSessionEpoch())
            throw new Error("Vault locked");
          return result;
        },
        () => crypto.randomUUID(),
        "AUDIT",
      );
      if (generation.current !== revision) {
        await opened.close();
        return;
      }
      journal.current = opened;
      setClient(value);
      setDevices(await value.devices());
    } catch {
      await opened?.close();
      setClient(null);
      setStatus("解锁失败，请检查口令、浏览器安全存储与登录状态。");
    } finally {
      setBusy(false);
    }
  };
  const act = async (work: () => Promise<unknown>) => {
    if (busy || !client) return;
    setBusy(true);
    setStatus("");
    try {
      await client.run(work);
      setDevices(await client.devices());
      setStatus("操作已完成");
    } catch {
      setStatus("操作未完成，请检查设备批准状态与权限后重试。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider value={client}>
      <Collapse className="encryption-settings" items={[{
        key: "device",
        label: client ? "加密消息访问 · 已解锁" : "加密消息访问 · 未解锁",
        children: (<>
        <Alert
          type="info"
          showIcon
          title="私钥只保存在此浏览器的加密保险库中。解锁后才能读取已授权会话的文字；切换到后台会锁定。新设备不能自动读取加入前的历史。"
        />
        {!client ? (
          <Space style={{ marginTop: 12 }}>
            <Input.Password
              aria-label="解密设备口令"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="本机解锁口令（至少 12 字符）"
            />
            <Button
              loading={busy}
              disabled={busy || password.length < 12}
              onClick={() => void unlock()}
            >
              创建 / 解锁本机保险库
            </Button>
          </Space>
        ) : (
          <Space
            orientation="vertical"
            style={{ width: "100%", marginTop: 12 }}
          >
            <Typography.Text copyable>{client.device.deviceId}</Typography.Text>
            <Typography.Text copyable>
              {client.device.publicIdentity().publicKey}
            </Typography.Text>
            <Typography.Text>
              首次管理员设备须将上面的公钥配置为后端
              E2EE_AUDIT_ROOT_PUBLIC_KEY。请先保管好本机口令与浏览器数据；服务器不保存恢复私钥。
            </Typography.Text>
            <Space>
              <Button
                disabled={busy}
                onClick={() =>
                  void act(() => client.register("管理员授权浏览器"))
                }
              >
                登记 / 发布加入密钥
              </Button>
              <Button aria-label="锁定" onClick={lock}>
                锁定
              </Button>
            </Space>
            <Typography.Text>
              恢复码只能离线保管；它可以解密此管理员账号归档的历史。恢复后仍需当前管理员权限。归档遵守原消息清空、撤回和焚毁规则。
            </Typography.Text>
            <Button
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const revision = generation.current;
                  const code = await client.createRecovery();
                  if (revision === generation.current && !document.hidden)
                    setRecoveryCode(code);
                })
              }
            >
              创建 / 查看本机恢复码
            </Button>
            {recoveryCode && <Typography.Text>{recoveryCode}</Typography.Text>}
            <Input.Password
              aria-label="恢复码"
              autoComplete="off"
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value)}
              placeholder="恢复码"
            />
            <Button
              disabled={busy || !enteredCode.trim()}
              onClick={() =>
                void act(async () => {
                  const code = enteredCode;
                  setEnteredCode("");
                  await client.recover(code);
                })
              }
            >
              使用恢复码批准本机
            </Button>
            <Input
              aria-label="归档访问原因"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="归档 / 恢复原因（写入审计日志）"
              maxLength={500}
            />
            <Space>
              <Button
                disabled={busy || archiveReason.trim().length < 2}
                onClick={() =>
                  void act(async () => {
                    setArchiveCount(await client.backupHistory(archiveReason));
                  })
                }
              >
                归档已解密历史
              </Button>
              <Button
                disabled={busy || archiveReason.trim().length < 2}
                onClick={() =>
                  void act(async () => {
                    setArchiveCount(await client.restoreHistory(archiveReason));
                  })
                }
              >
                恢复历史
              </Button>
            </Space>
            {archiveCount !== undefined && (
              <Typography.Text>
                已处理 {archiveCount} 条历史消息
              </Typography.Text>
            )}
            <Input
              aria-label="待恢复会话 ID"
              value={managedConversation}
              onChange={(e) => setManagedConversation(e.target.value)}
              placeholder="原管理设备已撤销的会话 ID"
            />
            <Button
              disabled={busy || !/^[0-9a-f-]{36}$/i.test(managedConversation)}
              onClick={() =>
                void act(async () => {
                  const directory = await client.directory(managedConversation);
                  Modal.confirm({
                    title: "核对全部设备公钥后，接管已失效的管理设备？",
                    width: 720,
                    content: (
                      <pre
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {directory.devices
                          .map(
                            (v) =>
                              `${displayLabel("devicePurpose",v.purpose)} ${v.label}\n${v.id}\n${v.publicKey}`,
                          )
                          .join("\n\n")}
                      </pre>
                    ),
                    okText: "已核对，恢复会话",
                    onOk: () =>
                      act(async () => {
                        await client.trust(directory.devices);
                        await client.reconcile(managedConversation);
                      }),
                  });
                })
              }
            >
              恢复失去管理设备的会话
            </Button>
            {devices.map((d) => (
              <Space key={d.id} orientation="vertical">
                <Typography.Text>
                  {d.label} · {displayLabel("deviceStatus", d.status)}
                </Typography.Text>
                <Typography.Text copyable>{d.publicKey}</Typography.Text>
                {d.status === "PENDING" && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      Modal.confirm({
                        title: "已在新设备上核对完整公钥？",
                        content: d.publicKey,
                        onOk: () =>
                          act(async () => {
                            await client.trust([d]);
                            return client.deviceAction(d, "approve");
                          }),
                      })
                    }
                  >
                    核对并批准
                  </Button>
                )}
                {d.status !== "REVOKED" && (
                  <Button
                    danger
                    disabled={busy}
                    onClick={() =>
                      Modal.confirm({
                        title: "撤销此设备？",
                        content: "撤销不可恢复；需要更新会话密钥才能继续发送。",
                        onOk: () => act(() => client.deviceAction(d, "revoke")),
                      })
                    }
                  >
                    撤销
                  </Button>
                )}
              </Space>
            ))}
          </Space>
        )}
        {status && (
          <Typography.Paragraph role="status">{status}</Typography.Paragraph>
        )}
      </>),
      }]} />
      {children}
    </Context.Provider>
  );
}
export function AdminEncryptedText({
  content,
  reason,
}: {
  content: EncryptedContent;
  reason: string;
}) {
  const client = useContext(Context);
  const [text, setText] = useState<{
    client: EncryptionClient;
    content: EncryptedContent;
    text: string;
  }>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(undefined);
    setStatus("");
  }, [client, content]);
  const decrypt = async () => {
    if (!client || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const body = await client.run(() => client.decrypt(content, reason));
      setText({
        client,
        content,
        text: typeof body.text === "string" ? body.text : "",
      });
    } catch {
      setStatus("请先核对会话设备密钥，确认此管理员设备已加入该会话。");
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!client || busy) return;
    setBusy(true);
    try {
      const d = client.device;
      const id = content.envelope.conversationId;
      const payload = [d.userId, "AUDIT", id, d.deviceId, 0, reason];
      const response = await apiClient<{ devices: PublicDevice[] }>(
        `/admin/e2ee/conversations/${id}/events`,
        {
          method: "POST",
          cache: "no-store",
          body: JSON.stringify({
            actorDeviceId: d.deviceId,
            afterEpoch: 0,
            reason,
            signature: await d.signPayload("events", payload),
          }),
        },
      );
      Modal.confirm({
        title: "请逐一与实际设备核对以下公钥",
        width: 720,
        content: (
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {response.devices
              .map((v) => `${displayLabel("devicePurpose",v.purpose)} ${v.label}\n${v.id}\n${v.publicKey}`)
              .join("\n\n")}
          </pre>
        ),
        okText: "已独立核对一致",
        onOk: () => client.run(() => client.trust(response.devices)),
      });
    } catch {
      setStatus(
        "无法读取会话设备，请检查当前设备批准状态、会话授权和访问原因。",
      );
    } finally {
      setBusy(false);
    }
  };
  if (!client) return <span>[加密文字：请先解锁管理员设备]</span>;
  return (
    <Space orientation="vertical">
      {text && text.client === client && text.content === content ? (
        <span style={{ whiteSpace: "pre-wrap" }}>{text.text}</span>
      ) : (
        <Button disabled={busy} onClick={() => void decrypt()}>
          在此设备解密
        </Button>
      )}
      <Button size="small" disabled={busy} onClick={() => void verify()}>
        核对会话设备密钥
      </Button>
      {status && <span>{status}</span>}
    </Space>
  );
}
