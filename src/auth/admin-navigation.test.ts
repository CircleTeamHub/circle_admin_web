import { expect, it } from "vitest";
import { ADMIN_NAVIGATION } from "./admin-navigation";
it("keeps memberships and removes retired fancy-number management entries", () => {
  expect(ADMIN_NAVIGATION.some((item) => item.key === "/memberships")).toBe(
    true,
  );
  expect(
    ADMIN_NAVIGATION.some((item) => /fancy|靓号/.test(item.key + item.label)),
  ).toBe(false);
});

it("has a single dashboard entry for overview and product insights", () => {
  expect(ADMIN_NAVIGATION.filter((item) => item.key === "/")).toHaveLength(1);
  expect(ADMIN_NAVIGATION.some((item) => item.key === "/insights")).toBe(false);
});
