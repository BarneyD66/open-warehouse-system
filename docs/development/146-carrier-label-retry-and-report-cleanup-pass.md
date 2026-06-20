# 146 承运商面单重试与生命周期报表

## 本轮目标

继续补齐真实承运商闭环中“失败可恢复、过程可追踪、报表可排障”的能力。

## 已完成

- 清理 `/api/ops/carrier-labels/retry-due` 中文文案。
- 保留两种触发方式：员工后台触发，或通过 `CARRIER_LABEL_RETRY_SECRET` / `CRON_SECRET` 定时任务触发。
- 清理 `/api/ops/platform-fulfillment/retry-due` 中文文案，用于平台发货追踪号失败后的批量重试。
- 清理 `/api/ops/reports/carrier-labels` 报表导出，CSV 表头、状态、审计记录均为中文。
- 面单生命周期报表新增状态代码列，方便后续保存视图、自动筛选和运营排障。

## 对标马帮后的价值

- 真实承运商 API 偶发失败后，不需要员工逐单手工补救。
- 运营可以通过报表快速定位失败原因、失败次数、下次重试时间、承运商运单 ID、平台回传状态。
- 后续接入 Royal Mail、DPD、Evri 正式账号时，这套失败恢复和报表链路可以直接承接生产流量。
