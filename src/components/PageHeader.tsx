import { Typography } from "antd";
import type { ReactNode } from "react";

export function PageHeader({ title, description, extra }: { title: ReactNode; description?: ReactNode; extra?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <Typography.Title level={3}>{title}</Typography.Title>
        {description && <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>}
      </div>
      {extra && <div className="page-header-actions">{extra}</div>}
    </header>
  );
}
