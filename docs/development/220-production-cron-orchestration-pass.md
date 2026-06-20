# 220 生产自动化 Cron 调度收口

本轮继续按对标马帮后的生产级缺口推进，把已经存在的自动同步、重试、提醒、报表发送等接口串成可由 Vercel Cron 调度的统一入口。

## 已完成

- 新增 `vercel.json`：
  - 配置 `/api/ops/automation/run-due` 每小时执行一次。
  - 生产环境通过 `CRON_SECRET` / `AUTOMATION_RUN_SECRET` 校验 Vercel Cron 的 `Authorization: Bearer ...`。
- 清理统一自动化调度接口：
  - `/api/ops/automation/run-due`
  - 中文任务名称、执行摘要、审计日志已整理为可读文案。
  - 自动分发平台订单同步、平台取消复核、批量作业执行/重试、拣货波次生成、库存批次风险、库位风险、承运商面单重试、承运商轨迹/POD 同步、平台发货回传、通知生成、通知投递重试、定时报表发送。
- 清理关键 Cron 子任务中文文案和授权兼容：
  - `/api/ops/platform-orders/sync-due`
  - `/api/ops/platform-fulfillment/retry-due`
  - `/api/ops/carrier-labels/retry-due`
  - `/api/ops/carrier-tracking/sync-due`
  - `/api/ops/jobs/run-due`
  - `/api/ops/jobs/retry-due`
  - `/api/ops/notifications/generate-due`
  - `/api/ops/notifications/deliveries/retry-due`
  - `/api/ops/reports/schedules/run`
- 定时报表发送接口新增 GET 支持，并兼容 `REPORT_SCHEDULE_SECRET` 或统一 `CRON_SECRET`。
- 多个子任务支持 `Authorization: Bearer <secret>` 和 `?secret=` 两种排查方式，便于本地、Vercel Cron、外部调度器联调。

## 验证

- `npm run lint`
- `npm run build`
- 重点调度目录乱码扫描无命中。

## 生产配置

至少需要在 Vercel 生产环境配置：

- `CRON_SECRET`
- 或单独配置 `AUTOMATION_RUN_SECRET`

如需各子任务独立密钥，可继续配置：

- `PLATFORM_ORDER_SYNC_SECRET`
- `PLATFORM_FULFILLMENT_RETRY_SECRET`
- `CARRIER_LABEL_RETRY_SECRET`
- `CARRIER_TRACKING_SYNC_SECRET`
- `JOB_RUN_SECRET`
- `JOB_RETRY_SECRET`
- `NOTIFICATION_GENERATE_SECRET`
- `NOTIFICATION_RETRY_SECRET`
- `REPORT_SCHEDULE_SECRET`

## 下一步

- 继续清理生产体检/系统健康模块中的历史编码显示问题。
- 在运营后台补“Cron 调度状态”可视化：显示最近一次统一自动化执行时间、成功/失败任务数、失败任务快捷重试。
- 部署后在 Vercel 面板确认 Cron 已创建，并检查首次执行日志。
