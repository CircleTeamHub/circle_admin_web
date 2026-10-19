import { Alert, Descriptions, Typography } from "antd";
export function UpdateDecisionSummary({
  decision,
}: {
  decision: { update: unknown; mandatory: boolean };
}) {
  const update = decision.update;
  const available =
    !!update &&
    typeof update === "object" &&
    "version" in update &&
    typeof update.version === "string";
  return (
    <>
      <Alert
        type={available ? (decision.mandatory ? "warning" : "success") : "info"}
        title={
          available
            ? decision.mandatory
              ? "需要更新后继续使用"
              : "有可选更新"
            : update === null
              ? "当前条件下没有可用更新"
              : "更新信息暂不可用"
        }
      />
      {available && (
        <Descriptions
          column={1}
          size="small"
          items={[
            {
              key: "version",
              label: "目标版本",
              children: update.version as string,
            },
            {
              key: "notes",
              label: "更新说明",
              children:
                "notes" in update && typeof update.notes === "string"
                  ? update.notes || "未填写"
                  : "未记录",
            },
          ]}
        />
      )}
      <details>
        <summary>技术详情（排查用）</summary>
        <Typography.Paragraph>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {JSON.stringify(decision, null, 2)}
          </pre>
        </Typography.Paragraph>
      </details>
    </>
  );
}
