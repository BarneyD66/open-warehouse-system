# 125 Webhook 持久化幂等台账

## 背景

真实承运商和平台 API 闭环依赖 webhook 回传。原有承运商/平台 webhook 已具备签名校验和短时内存去重，但生产环境下 serverless 实例重启或多实例并发时，进程内 Map 无法保证重复事件被稳定识别。

## 本次完成

- 新增 `webhookEventStore`：
  - 支持承运商和平台两类 webhook。
  - 支持 Postgres 表 `warehouse_webhook_events`。
  - 本地/临时环境回落到 `.local-data` 或 `/tmp` 文件。
  - 支持 `claimWebhookEvent` 和 `completeWebhookEvent`，记录 `processing / processed / ignored / failed` 状态。
  - 当外部未提供事件 ID 时，用请求 body 的 SHA-256 生成幂等键。
- 承运商 webhook `/api/webhooks/carriers/[provider]` 接入持久化幂等：
  - 重复轨迹/POD 回传会直接返回 duplicate。
  - 未匹配出库单会记录 failed。
  - 成功写入轨迹或异常后记录 processed。
- 平台 webhook `/api/webhooks/platforms/[platform]` 接入持久化幂等：
  - 重复取消/作废订单事件不会重复截单或重复取消面单。
  - 非取消类事件记录 ignored。
  - 缺少订单号或未匹配出库单记录 failed。
- 运营后台总览新增“Webhook 回调台账”：
  - 展示最近承运商/平台回调。
  - 展示处理状态、provider、eventId、目标单号、摘要和错误。

## 生产价值

- 降低承运商重复回传导致重复异常、重复签收证明、重复轨迹的风险。
- 降低平台重复取消事件导致重复截单/重复取消面单的风险。
- 运营可以直接看到最近 webhook 是否失败或未匹配订单，便于排查真实 API 联调问题。

## 验证

- `npm run lint`
- `npm run build`
- `git diff --check`
