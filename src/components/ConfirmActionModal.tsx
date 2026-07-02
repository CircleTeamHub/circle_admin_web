import { Modal } from "antd";

export function confirmAction(config: {
  title: string;
  content: React.ReactNode;
  okText: string;
  okType?: "primary" | "danger";
  onOk: () => void | Promise<void>;
}) {
  Modal.confirm({
    title: config.title,
    content: config.content,
    okText: config.okText,
    okType: config.okType,
    cancelText: "取消",
    onOk: config.onOk,
  });
}
