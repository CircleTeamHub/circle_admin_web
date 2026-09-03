import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { initSentry, SentryErrorBoundary } from "./observability/sentry";
import "antd/dist/reset.css";
import "./styles.css";

// 只有配置了 VITE_SENTRY_DSN 才真正初始化；否则整条链路是 no-op。
initSentry();

function RootCrashFallback() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: "0 0 8px" }}>页面出错了</h2>
      <p style={{ margin: 0 }}>请刷新页面重试；问题已自动上报。</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SentryErrorBoundary fallback={<RootCrashFallback />}>
      <App />
    </SentryErrorBoundary>
  </React.StrictMode>,
);
