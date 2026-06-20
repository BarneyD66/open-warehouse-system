# 109 承运商面单自动重试闭环

本轮补齐真实承运商 API 闭环里的“面单购买失败自动恢复”能力，让面单失败不只停留在告警和单票手动重试。

## 已完成

- 新增 `/api/ops/carrier-labels/retry-due`：
  - 支持 `GET` 和 `POST`。
  - 支持 `Authorization: Bearer <secret>` 定时任务调用。
  - 密钥读取顺序：`CARRIER_LABEL_RETRY_SECRET`，其次 `CRON_SECRET`。
  - 也支持已登录的 `admin` / `ops` 员工手动调用。
  - 默认一次最多重试 50 条，接口最大限制 200 条。
- 自动筛选到期面单：
  - 出库单尚未发货。
  - `labelStatus = failed`。
  - 没有转为内部/人工面单。
  - `labelNextRetryAt` 为空或已到期。
- 重试逻辑复用现有 `generateCoreOutboundShippingLabel`：
  - 继续走承运商配置、运费规则、黑名单/限制规则和真实网关。
  - 成功后写回追踪号、面单地址和面单状态。
  - 失败后继续累计失败原因、尝试次数和下次重试时间。
- 审计日志新增：
  - `carrier_label_retry_due`
  - 后台审计导出和审计面板均有中文标签。
- 承运商集成就绪检查新增：
  - `CARRIER_LABEL_RETRY_SECRET`
  - `CRON_SECRET`
  - 缺少自动重试密钥时会提示配置调度器调用 `/api/ops/carrier-labels/retry-due`。

## 业务价值

- Royal Mail / DPD / Evri 等真实面单接口短暂失败后，可以自动恢复。
- 运营不需要逐单点击“重试面单”。
- 审计日志能看到每次批量重试的尝试数、成功数和失败数。
