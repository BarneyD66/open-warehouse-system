# 112 - 平台订单 API 到期同步任务

## 本轮目标

把平台订单 API 同步从“运营手动点击单个店铺同步”推进到“可由 Cron 或运营批量触发”的生产化能力，继续补齐对标马帮后的平台订单同步闭环。

## 已完成

- 新增 `/api/ops/platform-orders/sync-due`：
  - 支持 `GET` 和 `POST`。
  - 支持员工会话触发，限管理员和运营角色。
  - 支持 `Authorization: Bearer <secret>` 或 `?secret=` 的定时任务调用。
  - 密钥读取顺序：`PLATFORM_ORDER_SYNC_SECRET`，其次 `CRON_SECRET`。
  - 默认每次最多同步 20 个到期平台连接。
  - 默认 30 分钟内已同步的连接不会重复拉单。
  - 支持 `limit`、`minIntervalMinutes`、`connectionId` 参数。
- 同步逻辑复用现有 `syncPlatformConnection`：
  - 拉取平台订单。
  - 识别取消/作废订单。
  - 生成平台同步任务记录。
  - 生成订单导入预检草稿。
  - 保留异常行、库存不足和字段校验问题。
- 新增审计动作 `platform_orders_sync_due`：
  - 记录扫描连接数、尝试数、成功数、失败数和每个连接结果。
  - 审计日志导出和前端面板均显示中文“平台订单到期同步”。
- 运营后台“平台订单导入和字段映射”模块新增按钮：
  - “同步到期平台订单”
  - 运营可以不通过接口地址，直接在后台触发一轮同步。
- 生产集成体检补充：
  - `PLATFORM_ORDER_SYNC_SECRET`
  - 如果未配置该密钥或 `CRON_SECRET`，平台 API 连接不会被判定为完整 ready。
  - 下一步提示会引导调度器调用 `/api/ops/platform-orders/sync-due`。

## 验证

- `npm run lint` 通过。
- `npm run build` 通过。
- 构建路由已包含 `/api/ops/platform-orders/sync-due`。

## 后续建议

- 在 Vercel Cron 或外部调度器配置：
  - URL：`/api/ops/platform-orders/sync-due`
  - Header：`Authorization: Bearer <PLATFORM_ORDER_SYNC_SECRET 或 CRON_SECRET>`
- 正式接 Amazon、TikTok Shop、Shopify、eBay 时，按每个平台配置 `*_ORDERS_URL`、`*_FULFILLMENT_URL`、`*_API_TOKEN` 或 `credentialRef=XXX`。

