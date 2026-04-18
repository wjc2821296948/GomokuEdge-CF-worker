# GomokuEdge

适用于 Cloudflare Workers 的在线五子棋网页（免费方案可用）。

## 为什么会出现你的报错

你日志里的核心报错是：

- `Could not detect a directory containing static files`

这通常发生在 **没有 `wrangler.toml`** 的情况下，`wrangler` 会把项目当成 Pages 静态站点流程去推断目录（例如 `dist`、`public`），但本项目是 **Workers 脚本入口（`worker.js`）**，不是纯静态目录项目。

## 解决方案（已在仓库内修复）

已新增 `wrangler.toml`，明确指定：

- Worker 入口：`main = "worker.js"`
- 兼容日期：`compatibility_date = "2026-04-17"`
- KV 绑定：`GOMOKU_ROOMS`

这样在 Cloudflare 构建环境执行 `npx wrangler deploy` 时，会直接走 Workers 部署路径，不再要求静态目录。

## 你还需要做的一步（必须）

把 `wrangler.toml` 中的占位符替换成你自己的 KV Namespace ID：

- `id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"`
- `preview_id = "REPLACE_WITH_YOUR_KV_NAMESPACE_ID"`

### 创建 KV（免费）

```bash
npx wrangler kv namespace create GOMOKU_ROOMS
npx wrangler kv namespace create GOMOKU_ROOMS --preview
```

将返回的两个 ID 填入 `wrangler.toml`。

## 推荐部署方式（尽量用 Cloudflare，减少本地算力）

### 方式 A：Cloudflare Workers（推荐）

在 Cloudflare Dashboard 或 CI 的部署命令使用：

```bash
npx wrangler deploy
```

### 方式 B：Cloudflare Pages + Functions（可选）

如果你坚持走 Pages，需要把 Worker 逻辑迁到 `functions/` 目录结构；当前仓库是标准 Workers 项目，不建议强行按 Pages 静态目录方式部署。
