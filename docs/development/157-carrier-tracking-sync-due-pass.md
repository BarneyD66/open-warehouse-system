# 157 - 承运商轨迹与签收证明自动同步

## 背景

系统已有真实/沙箱承运商面单购买、取消面单、webhook 回传、手动轨迹同步和签收证明处理。但如果承运商 webhook 延迟、漏发或客户需要主动刷新签收证明，运营仍需要手动进入单据触发同步。

## 本次开发

- 新增 `/api/ops/carrier-tracking/sync-due`，支持员工手动执行或通过 `CARRIER_TRACKING_SYNC_SECRET` / `CRON_SECRET` 定时调用。
- 自动筛选已有追踪号/承运商运单号、尚未完成签收闭环、且超过同步间隔的出库单。
- 调用现有承运商网关 `fetchCarrierTrackingAndProof` 主动拉取轨迹和 POD。
- 自动写入出库轨迹事件。
- 已签收且返回 POD 时，自动生成“签收证明”记录，客户侧可自助下载。
- 承运商返回派送异常时，自动生成物流异常和客户待确认工单。
- 新增审计动作 `carrier_tracking_sync_due`，记录尝试、成功、失败、签收证明和异常数量。
- 接入生产自动化总调度 `/api/ops/automation/run-due` 和失败任务重试 `/api/ops/automation/task-actions`。
- 生产集成体检新增 `CARRIER_TRACKING_SYNC_SECRET` 检查项，并提示调度器调用 `/api/ops/carrier-tracking/sync-due`。

## 验收口径

- 承运商 webhook 漏发时，系统仍可通过定时任务主动拉取轨迹和签收证明。
- 物流异常、派送失败和 POD 自动进入现有异常/工单/客户自助体系。
- 自动化总调度能统一执行平台订单、批量作业、面单重试、轨迹/POD 同步、发货回传、通知和报表任务。
