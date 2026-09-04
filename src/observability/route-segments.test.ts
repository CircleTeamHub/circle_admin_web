import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { STATIC_ROUTE_SEGMENTS } from "./route-segments";

// 白名单方案只有在「清单与真实路由一致」时才成立。这条测试是那个前提的守卫：
// 新增页面 / 接口却忘了同步清单，这里必红。
//
// 漂移的后果是不对称的，所以两个方向都要报错：
//   - 清单少了段 → 那条路径的段退化成 :id。只丢分组粒度，不泄漏。
//   - 清单多了段 → 一个不再是路由的词被当作安全值保留；若与某个用户可控的 id
//                 相同即构成泄漏。
// vitest 在 jsdom 环境下 import.meta.url 不是 file: URL，所以从项目根（vitest 的 cwd）定位。
const API_DIR = join(process.cwd(), "src", "api");
const ROUTER_FILE = join(process.cwd(), "src", "app", "App.tsx");

/** community.ts 把动作名插进模板（`/circles/${id}/${action}`），字面量扫描看不到，这里显式登记。 */
const INTERPOLATED_ACTION_SEGMENTS = ["disable", "restore"];

function addPathSegments(target: Set<string>, template: string): void {
  for (const segment of template.split("?")[0].split("/")) {
    // 空段、模板插值、react-router 的 :param 与 * 都不是静态段。
    if (segment === "" || segment.includes("${") || segment.startsWith(":") || segment === "*") {
      continue;
    }
    target.add(segment);
  }
}

/** src/api/*.ts 里以 `/` 开头的字符串 / 模板字面量（API_BASE_URL 默认值也在其中）。 */
function segmentsFromApiLiterals(): Set<string> {
  const segments = new Set<string>();
  for (const name of readdirSync(API_DIR)) {
    if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
    const source = readFileSync(join(API_DIR, name), "utf8");
    for (const match of source.matchAll(/["'`](\/[^"'`]*)["'`]/g)) {
      addPathSegments(segments, match[1]);
    }
  }
  return segments;
}

/** src/app/App.tsx 路由表里每个 `<Route path="…">`。 */
function segmentsFromRouterTable(): Set<string> {
  const segments = new Set<string>();
  const source = readFileSync(ROUTER_FILE, "utf8");
  for (const match of source.matchAll(/\bpath="([^"]+)"/g)) {
    addPathSegments(segments, match[1]);
  }
  return segments;
}

describe("STATIC_ROUTE_SEGMENTS", () => {
  it("matches the router table and the API path literals exactly", () => {
    const expected = new Set([
      ...segmentsFromRouterTable(),
      ...segmentsFromApiLiterals(),
      ...INTERPOLATED_ACTION_SEGMENTS,
    ]);

    const missing = [...expected].filter((segment) => !STATIC_ROUTE_SEGMENTS.has(segment)).sort();
    const stale = [...STATIC_ROUTE_SEGMENTS].filter((segment) => !expected.has(segment)).sort();

    expect(
      missing,
      `路由表 / API 里有静态段不在白名单中，这些路径会退化成 :id。缺少: ${missing.join(", ")}`,
    ).toEqual([]);
    expect(
      stale,
      `白名单里有段已不是路由，会被当作安全值原样发给 Sentry。多余: ${stale.join(", ")}`,
    ).toEqual([]);
  });

  it("contains only lowercase static route words", () => {
    // 空集合会让每条路径都变成 :id —— 测试全过但分组没了。
    expect(STATIC_ROUTE_SEGMENTS.size).toBeGreaterThan(20);
    for (const segment of STATIC_ROUTE_SEGMENTS) {
      expect(segment).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });
});
