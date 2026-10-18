import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CodeValue, Identifier } from "./ReadableValue";
it("shows Chinese labels while keeping original codes available for diagnosis", () => {
  render(
    <>
      <CodeValue domain="userStatus" value="ACTIVE" />
      <CodeValue domain="userStatus" value="FUTURE" />
    </>,
  );
  expect(screen.getByText("正常").getAttribute("title")).toBe(
    "原始代码：ACTIVE",
  );
  expect(screen.getByText("未识别值").getAttribute("title")).toBe(
    "原始代码：FUTURE",
  );
  expect(screen.queryByText("ACTIVE")).toBeNull();
});
it("keeps internal identifiers out of lists and copies the complete value from details", () => {
  const id = "12345678-1234-5678-90ab-abcdef123456";
  render(<Identifier value={id} />);
  expect(screen.queryByTitle(id)).toBeNull();
  expect(screen.queryByText(/12345678/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "编号详情" }));
  expect(screen.getByTitle(id).textContent).toBe(id);
  expect(screen.getByRole("button", { name: /复制|Copy/ })).toBeTruthy();
});
it("shows full identifiers when already inside a record detail view", () => {
  const id = "12345678-1234-5678-90ab-abcdef123456";
  render(<Identifier value={id} inline />);
  expect(screen.getByTitle(id).textContent).toBe(id);
  expect(screen.queryByRole("button", { name: "编号详情" })).toBeNull();
});
