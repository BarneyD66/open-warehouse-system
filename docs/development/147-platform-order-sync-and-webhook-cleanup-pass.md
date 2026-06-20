# 147 平台订单同步、取消 webhook 与同步报表

## 本轮目标

继续补齐对标马帮的“多平台订单同步闭环”：定时拉单、取消订单回调、异常拦截和同步报表排障。

## 已完成

- 清理 `/api/ops/platform-orders/sync-due` 中文文案，保留员工触发和 `PLATFORM_ORDER_SYNC_SECRET` / `CRON_SECRET` 定时触发。
- 清理 `/api/webhooks/platforms/[platform]`，平台取消/作废订单回调会自动匹配出库单。
- 未发货出库单会自动发起截单申请，已生成面单会尝试取消承运商面单。
- 已发货出库单会生成派送/退回异常，避免平台取消后仓库和客户看不到风险。
- 清理 `/api/ops/reports/platform-sync`，平台同步任务报表 CSV 全中文，并新增同步模式代码、结果代码。

## 对标马帮后的价值

- 平台订单不仅能同步进来，也能把取消/作废事件带回仓库作业。
- 运营可以按平台、客户、结果和关键字导出同步任务，查看拉取行数、可创建订单、异常行、取消订单和下一步处理。
- 后续接 Amazon、TikTok Shop、Shopify、eBay 正式 API 时，这条任务与 webhook 链路可以复用。
