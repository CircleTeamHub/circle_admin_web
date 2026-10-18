import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import {
  grantMembership,
  listMembers,
  listPlans,
  listMembershipGrants,
} from "../api/admin-commerce";
import { MembershipsPage, membershipGrantPlanLabel } from "./MembershipsPage";
vi.mock("../api/admin-commerce", () => ({
  grantMembership: vi.fn(),
  listMembers: vi.fn(),
  listPlans: vi.fn(),
  listMembershipGrants: vi.fn(),
}));
function show() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter>
        <MembershipsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listPlans).mockResolvedValue([
    { level: 1, key: "silver", priceCny: 298, lifetime: false },
    { level: 2, key: "gold", priceCny: 1288, lifetime: false },
  ]);
  vi.mocked(listMembers).mockResolvedValue({
    items: [
      {
        id: "user",
        accountId: "ming",
        nickname: "小明",
        vipLevel: 0,
        vipExpiresAt: null,
        membershipGrantsReceived: [],
      },
    ],
    nextCursor: null,
  });
  vi.mocked(listMembershipGrants).mockResolvedValue({
    items: [],
    nextCursor: null,
  });
  vi.mocked(grantMembership).mockResolvedValue({});
});
it("offers the App daily silver plan and submits its duration selector with the normal level", async () => {
  show();
  fireEvent.click(await screen.findByRole("button", { name: /激活 \/ 升级/ }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "会员开通方案" }));
  fireEvent.click(await screen.findByText("每日会员（1天白银权益，19.9元）"));
  fireEvent.change(screen.getByRole("spinbutton",{name:"每日会员数量"}),{target:{value:"30"}});
  fireEvent.click(screen.getByRole("button", { name: "确认发放" }));
  await waitFor(() =>
    expect(grantMembership).toHaveBeenCalledWith(
      "user",
      expect.objectContaining({
        targetLevel: 1,
        planId: "daily",
        quantity: 30,
        idempotencyKey: expect.any(String),
      }),
    ),
  );
});
it("preserves the existing monthly request when the daily plan is not selected", async () => {
  show();
  fireEvent.click(await screen.findByRole("button", { name: /激活 \/ 升级/ }));
  fireEvent.click(screen.getByRole("button", { name: "确认发放" }));
  await waitFor(() => expect(grantMembership).toHaveBeenCalled());
  expect(vi.mocked(grantMembership).mock.calls[0][1]).toMatchObject({
    targetLevel: 1,
  });
  expect(vi.mocked(grantMembership).mock.calls[0][1]).not.toHaveProperty(
    "planId",
  );
});
it("shows daily duration in history while interpreting historical untagged records as the normal tier", () => {
  expect(membershipGrantPlanLabel({ newLevel: 1, planId: "daily" })).toBe(
    "每日会员（1天白银权益）",
  );
  expect(membershipGrantPlanLabel({ newLevel: 1, planId: null })).toContain(
    "1个月",
  );
});

it("requires a daily quantity and limits selection to 30 units",async()=>{
 show();fireEvent.click(await screen.findByRole("button",{name:/激活 \/ 升级/}));
 fireEvent.mouseDown(screen.getByRole("combobox",{name:"会员开通方案"}));fireEvent.click(await screen.findByText("每日会员（1天白银权益，19.9元）"));
 const input=screen.getByRole("spinbutton",{name:"每日会员数量"});expect(input).toHaveAttribute("aria-valuemax","30");
 fireEvent.change(input,{target:{value:""}});expect(screen.getByRole("button",{name:"确认发放"})).toBeDisabled();
 expect(grantMembership).not.toHaveBeenCalled();
 expect(membershipGrantPlanLabel({planId:"daily",newLevel:1,quantity:30})).toBe("每日会员（30天白银权益）");
});
