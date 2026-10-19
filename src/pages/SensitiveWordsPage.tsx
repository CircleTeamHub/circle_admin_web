import { PageHeader } from "../components/PageHeader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Modal, Space, Table, Typography, message } from "antd";
import { useState } from "react";
import { listWords, mutateWords } from "../api/moderation";
import { PageError } from "../components/PageError";
import { getErrorMessage } from "../utils/errors";

export function SensitiveWordsPage() {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [text, setText] = useState("");
  const [remove, setRemove] = useState<string[]>();
  const words = useQuery({
    queryKey: ["sensitiveWords", page, search],
    queryFn: () => listWords(page, search),
  });
  const mutation = useMutation({
    mutationFn: ({
      action,
      values,
    }: {
      action: "add" | "remove";
      values: string[];
    }) => mutateWords(action, values),
    onSuccess: (result) => {
      message.success(`新增 ${result.added ?? 0}，删除 ${result.removed ?? 0}`);
      setText("");
      setRemove(undefined);
      void client.invalidateQueries({ queryKey: ["sensitiveWords"] });
    },
    onError: (error) => {
      message.error(getErrorMessage(error, "词表更新失败"));
      void client.invalidateQueries({ queryKey: ["sensitiveWords"] });
    },
  });
  const submit = (action: "add" | "remove") => {
    const values = [
      ...new Set(
        text
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (
      !values.length ||
      values.length > 1000 ||
      values.some((value) => value.length > 64)
    ) {
      message.error("请输入 1–1000 个词，每行一个，每词最多 64 字符");
      return;
    }
    if (action === "remove") setRemove(values);
    else mutation.mutate({ action, values });
  };
  return (
    <Space orientation="vertical" className="page-stack" size={16}>
      <PageHeader title="敏感词管理" description="搜索和维护词条；批量操作前请核对内容。" />
      <Input.Search
        placeholder="搜索词条"
        maxLength={200}
        onSearch={(value) => {
          setSearch(value.trim());
          setPage(1);
        }}
      />
      {words.isError && (
        <PageError error={words.error} onRetry={() => words.refetch()} />
      )}
      <Table
        rowKey="id"
        loading={words.isLoading}
        dataSource={words.data?.words ?? []}
        columns={[
          { title: "词条", dataIndex: "word" },
          {
            title: "操作",
            render: (_, row) => (
              <Button
                danger
                disabled={mutation.isPending}
                onClick={() => setRemove([row.word])}
              >
                删除
              </Button>
            ),
          },
        ]}
        pagination={{
          current: page,
          pageSize: 20,
          total: words.data?.total ?? 0,
          onChange: setPage,
        }}
      />
      <Typography.Title level={4} style={{ margin: "8px 0 0" }}>批量维护词条</Typography.Title>
      <Typography.Text type="secondary">每行输入一个词，最多 1000 个。删除前会再次确认。</Typography.Text>
      <Input.TextArea
        rows={6}
        maxLength={65000}
        value={text}
        disabled={mutation.isPending}
        onChange={(event) => setText(event.target.value)}
        placeholder="每行一个词，最多 1000 个，每词最多 64 字符"
      />
      <Space>
        <Button
          type="primary"
          loading={mutation.isPending}
          onClick={() => submit("add")}
        >
          批量新增
        </Button>
        <Button
          danger
          disabled={mutation.isPending}
          onClick={() => submit("remove")}
        >
          批量删除
        </Button>
      </Space>
      <Modal
        title={`确认删除 ${remove?.length ?? 0} 个词条`}
        open={!!remove}
        confirmLoading={mutation.isPending}
        onCancel={() => {
          if (!mutation.isPending) setRemove(undefined);
        }}
        onOk={() => {
          if (remove && !mutation.isPending)
            mutation.mutate({ action: "remove", values: remove });
        }}
      >
        <Typography.Paragraph
          style={{ maxHeight: 240, overflow: "auto", whiteSpace: "pre-wrap" }}
        >
          {remove?.join("\n")}
        </Typography.Paragraph>
      </Modal>
    </Space>
  );
}
