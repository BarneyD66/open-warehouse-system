# 108 平台发货回传自动重试闭环

本轮补齐平台订单 API 同步中的“发货追踪号回传失败恢复”能力，让系统从单票手动重试升级为可批量、可定时恢复。

## 已完成

- 新增 `/api/ops/platform-fulfillment/retry-due`：
  - 支持 `GET` 和 `POST`。
  - 支持 `Authorization: Bearer <secret>` 定时任务调用。
  - 密钥读取顺序：`PLATFORM_FULFILLMENT_RETRY_SECRET`，其次 `CRON_SECRET`。
  - 也支持已登录的 `admin` / `ops` 员工手动调用。
  - 默认一次最多重试 50 条，接口最大限制 200 条。
- 自动扫描并重试：
  - 有平台、平台订单号和追踪号。
  - 平台回传状态是 `pending`、`failed` 或空。
  - 未回传成功且不是无需回传。
- 回传结果写回出库单：
  - 成功：`platformFulfillmentStatus = synced`。
  - 失败：`platformFulfillmentStatus = failed`，并记录失败原因。
- 审计日志新增：
  - `platform_fulfillment_retry_due`
  - 后台审计导出和审计面板均有中文标签。
- 平台集成就绪检查新增：
  - `PLATFORM_FULFILLMENT_RETRY_SECRET`
  - `CRON_SECRET`
  - 缺少自动重试密钥时会提示配置调度器调用 `/api/ops/platform-fulfillment/retry-due`。

## 业务价值

- 平台发货回传失败后，不需要逐单人工点击重试。
- Vercel Cron 或外部调度器可以定时自动恢复。
- 老板和运营可以通过审计日志看到每次批量重试尝试、成功、失败数量。
