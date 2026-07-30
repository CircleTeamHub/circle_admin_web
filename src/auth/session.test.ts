import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearSession, setSession } from "./session";

describe("admin session notifications", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("notifies the app when the session is cleared", () => {
    setSession({ accessToken: "access", refreshToken: "refresh" });
    const listener = vi.fn();
    window.addEventListener("circle-admin-session-changed", listener);

    clearSession();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("circle-admin-session-changed", listener);
  });
});
