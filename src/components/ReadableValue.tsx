import { Button, Descriptions, Modal, Typography } from "antd";
import { useState } from "react";
import { displayLabel, type DisplayDomain } from "../utils/display";
export function CodeValue({
  domain,
  value,
}: {
  domain: DisplayDomain;
  value?: string | null;
}) {
  return (
    <Typography.Text title={value ? `原始代码：${value}` : undefined}>
      {displayLabel(domain, value)}
    </Typography.Text>
  );
}
export function Identifier({
  value,
  label,
  inline = false,
}: {
  value?: string | null;
  label?: string;
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!value) return <Typography.Text type="secondary">—</Typography.Text>;
  const full = (
    <Typography.Text
      title={value}
      copyable={{ text: value }}
      style={{ overflowWrap: "anywhere" }}
    >
      {value}
    </Typography.Text>
  );
  if (inline) return full;
  return (
    <>
      <Button type="link" size="small" onClick={() => setOpen(true)}>
        {label ? `${label}详情` : "编号详情"}
      </Button>
      <Modal
        title={label ? `${label}详情` : "记录编号详情"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">
          用于准确定位记录、关联日志和客服排查问题。日常操作无需记住这个编号。
        </Typography.Paragraph>
        <Descriptions
          column={1}
          items={[{ key: "id", label: "内部编号", children: full }]}
        />
      </Modal>
    </>
  );
}
