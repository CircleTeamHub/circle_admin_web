export function diagnosticResult(action: string, status?: number | null) {
  if (action === "console.request.failed") {
    if (status === 401)
      return {
        label: "登录已失效",
        color: "warning",
        advice: "重新登录后台后再试。",
      };
    if (status === 403)
      return {
        label: "权限不足",
        color: "warning",
        advice: "联系超级管理员检查当前账号的功能权限。",
      };
    if (status === 404)
      return {
        label: "记录或接口不存在",
        color: "warning",
        advice:
          "返回列表刷新，确认记录是否已删除；若持续出现，请联系开发人员。",
      };
    if (status === 429)
      return {
        label: "操作过于频繁",
        color: "warning",
        advice: "稍等片刻再试，避免连续重复提交。",
      };
    if (status && status >= 500)
      return {
        label: "服务处理异常",
        color: "error",
        advice:
          "服务暂时无法完成请求。联系开发人员，并提供详情中的排查编号；涉及付款或发放的操作，请先核对结果再决定是否重试。",
      };
    if (status && status >= 400)
      return {
        label: "请求未完成",
        color: "warning",
        advice:
          "检查页面提示、输入内容及记录当前状态。若仍有问题，请提供排查编号联系开发人员。",
      };
    return {
      label: "请求失败",
      color: "error",
      advice:
        "当时未记录具体失败类型，请提供详情中的排查编号，让开发人员关联服务日志排查。",
    };
  }
  if (action === "admin.login.failed")
    return {
      label: "登录失败",
      color: "warning",
      advice: "检查登录信息；若不是本人操作，请联系管理员核查账号安全。",
    };
  if (action.endsWith("_FAILED") || action.endsWith(".failed"))
    return {
      label: "操作失败",
      color: "error",
      advice: "查看操作说明，并核对相关任务或记录的最新状态。",
    };
  return {
    label: "操作记录",
    color: "default",
    advice: "正常操作留痕，无需按故障处理。",
  };
}

export function diagnosticDetails(row: {
  action: string;
  failureStatus?: number | null;
  requestMethod?: string | null;
  requestRoute?: string | null;
  failureCause?: string | null;
}) {
  const path = row.requestRoute?.replace(/^\/api\/v1/, "");
  const reads: Record<string, [string, string]> = {
    "/admin/console/tasks": ["后台任务中心", "加载后台任务列表"],
    "/admin/console/tasks/overview": ["后台任务中心", "加载任务处理概况"],
    "/admin/console/push": ["通知管理", "加载通知投递记录"],
    "/admin/console/push/overview": ["通知管理", "加载通知渠道与开关"],
    "/admin/console/analytics": ["数据看板", "加载用户使用统计"],
    "/admin/console/events": ["用户行为记录", "加载用户操作记录"],
    "/admin/console/diagnostics": ["问题排查", "加载失败记录"],
    "/admin/console/releases": ["App 版本管理", "加载版本记录"],
    "/admin/operations/audit-logs": ["管理员操作记录", "加载管理员操作记录"],
    "/admin/commerce/memberships": ["会员管理", "加载会员列表"],
    "/admin/content/posts": ["圈子内容管理", "加载圈子帖子"],
    "/admin/users": ["用户管理", "加载用户列表"],
  };
  const writes: Record<string, [string, string]> = {
    "POST /admin/console/push/:id/retry": ["通知管理", "重试失败通知"],
    "POST /admin/console/push/send": ["通知管理", "发送定向公告"],
    "PATCH /admin/console/push/settings": ["通知管理", "修改通知发送开关"],
    "POST /admin/memberships/users/:id/grants": [
      "会员管理",
      "发放会员权益",
    ],
  };
  const context = path
    ? row.requestMethod === "GET"
      ? reads[path]
      : writes[`${row.requestMethod} ${path}`]
    : undefined;
  const result = diagnosticResult(row.action, row.failureStatus);
  const causes: Record<string, string> = {
    DATABASE_QUERY_INVALID: "数据库查询参数不符合程序要求，属于程序查询错误。",
    DATABASE_UNAVAILABLE: "程序无法连接或初始化数据库。",
    DATABASE_REQUEST_FAILED: "数据库未能完成这次操作，需要开发人员核查。",
    INPUT_INVALID: "输入内容或筛选条件不符合要求。",
    LOGIN_EXPIRED: "当前登录状态已失效。",
    PERMISSION_DENIED: "当前账号没有执行该操作的权限。",
    RECORD_NOT_FOUND: "请求的记录或功能入口不存在。",
    STATE_CONFLICT: "记录状态已变化，与本次提交不一致。",
    RATE_LIMITED: "短时间内请求次数过多。",
    INTERNAL_ERROR: "服务内部发生异常，未记录更细的原因。",
  };
  const failure = row.action === "console.request.failed";
  return {
    page: context?.[0] ?? (failure ? "具体功能未记录" : "后台管理"),
    operation: context
      ? `${context[1]}失败`
      : failure
        ? "具体操作未记录"
        : undefined,
    cause:
      row.failureCause && causes[row.failureCause]
        ? causes[row.failureCause]
        : row.failureStatus && row.failureStatus >= 500
          ? "当时只记录了服务器错误，未保存具体原因。"
          : result.advice,
    impact:
      path === "/admin/console/tasks" && row.requestMethod === "GET"
        ? "这次失败的是读取任务列表，不代表通知发送或后台任务本身执行失败。"
        : row.requestMethod === "GET"
          ? "这次查询没有成功，页面数据可能未加载出来。"
          : "本次操作未确认成功，应先核对相关记录的实际状态。",
    advice:
      row.failureCause === "DATABASE_QUERY_INVALID"
        ? "请联系开发人员修复查询参数，反复点击通常无法解决。"
        : row.requestMethod === "GET" &&
            row.failureStatus &&
            row.failureStatus >= 500
          ? "可刷新页面重新查询；若持续失败，请提供排查编号联系开发人员。"
          : result.advice,
  };
}
