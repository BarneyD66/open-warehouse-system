# 103 通知投递到期重试闭环

本轮继续补齐消息中心的生产可用性，把外部通知从“可查看、可单条重试”推进到“可批量恢复”。

## 已完成

- 新增 `retryDueNotificationDeliveries(limit)`：
  - 自动筛选待投递通知。
  - 自动筛选已到建议重试时间的失败通知。
  - 不自动重复投递配置阻断的渠道，避免在 webhook 未配置时反复产生无效请求。
  - 返回尝试、成功、失败、阻断数量和明细。
- 更新 `/api/ops/notifications/deliveries`：
  - 保留 `retry` 单条重试。
  - 新增 `retry_due` 批量到期重试。
  - 管理权限限定为 `admin` 和 `ops`。
  - 单条重试和批量重试均写入审计日志。

## 使用方式

```http
POST /api/ops/notifications/deliveries
Content-Type: application/json

{
  "action": "retry_due",
  "limit": 50
}
```

## 业务价值

- 邮件、短信、微信通知失败后，可以由运营批量恢复。
- 审计日志能记录谁触发了重试、尝试了多少条、成功或失败多少条。
- 后续可以把该动作接入 Vercel Cron 或内部运维任务，实现自动重试。
