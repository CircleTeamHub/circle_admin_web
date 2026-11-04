import { expect, it } from "vitest";
import {
  notificationLabel,
  nextTaskAttempt,
  taskResult,
} from "./task-presentation";
import type { Task } from "../api/console";
const task = {
  status: "COMPLETED",
  nextAttemptAt: "2026-10-17T00:00:00Z",
} as Task;
it("explains notification types and handles missing or future types", () => {
  expect(notificationLabel("FRIEND_REQUEST_RECEIVED")).toBe("收到好友申请");
  expect(notificationLabel()).toBe("通知记录不可用");
  expect(notificationLabel("FUTURE")).toBe("其他通知（FUTURE）");
});
it("hides terminal schedules but preserves pending and processing schedules", () => {
  for (const status of ["COMPLETED", "SUCCEEDED", "TERMINAL"])
    expect(nextTaskAttempt({ ...task, status })).toBeNull();
  for (const status of ["PENDING", "PROCESSING"])
    expect(nextTaskAttempt({ ...task, status })).toBe(task.nextAttemptAt);
});

it("preserves the schedule for retryable notification failures", () => {
  expect(nextTaskAttempt({ ...task, status: "FAILED", retryable: true })).toBe(task.nextAttemptAt);
});

it("hides the obsolete schedule for exhausted failures", () => {
  expect(nextTaskAttempt({ ...task, status: "FAILED", retryable: false })).toBeNull();
});
it("distinguishes processing completion from delivery and handles mixed device results", () => {
  expect(taskResult({ ...task, deliveryCounts: {} })).toContain(
    "历史投递结果无法确认",
  );
  expect(
    taskResult({
      ...task,
      deliveryCounts: { SENT: 2, CONFIRMED: 1, TERMINAL: 1 },
    }),
  ).toBe("渠道已接受 2 条；回执记录 1 条；投递终止 1 条");
});

it("does not promise automatic retry for exhausted failures", () => {
  expect(taskResult({ ...task, status: "FAILED", retryable: false })).toBe("处理失败，不再自动重试");
});

it("keeps automatic retry copy for retryable notification failures", () => {
  expect(taskResult({ ...task, status: "FAILED", retryable: true })).toBe("本次处理失败，等待重试");
});

it("recognizes succeeded tasks as completed", () => {
  expect(taskResult({ ...task, status: "SUCCEEDED" })).toBe("后台处理完成");
});

it("distinguishes explicit skips from unknown historical results", () => {
  expect(
    taskResult({
      ...task,
      deliveryCounts: {},
      completionReason: "NO_ACTIVE_DEVICE",
    }),
  ).toContain("当时没有可用");
  expect(
    taskResult({
      ...task,
      deliveryCounts: {},
      completionReason: "CIRCLE_PUSH_DISABLED",
    }),
  ).toContain("用户关闭");
  expect(
    taskResult({ ...task, deliveryCounts: {}, completionReason: null }),
  ).toContain("历史投递结果无法确认");
});
