# 月结单确认与收款闭环

## 本轮完成

- 客户月结单详情页新增整月操作区：确认整月费用、提交付款参考号、申请开票、提出异议。
- 运营月结单详情页新增整月复核区：登记已收款、批量已开票、撤回收款、作废开票。
- 客户和运营都可以在月结单详情页按 `STMT-{customerCode}-{month}` 归档 PDF、付款资料或发票资料。
- 新增客户月结动作接口：`/api/billing/statement`。
- 扩展运营月结接口：`/api/ops/billing/statement` 支持收款和开票动作。
- 新增运营资料上传接口：`/api/ops/documents`。

## 业务口径

- 月结单不是新建独立账单表，而是按客户和月份批量更新已有账单明细，避免明细与汇总脱节。
- 客户确认会把本月未付款账单推进到 `confirmed`。
- 客户提交付款会把本月未付款账单推进到 `payment_submitted`，等待运营复核。
- 运营登记已收款会把非争议账单推进到 `paid`。
- 批量开票会把本月明细的 `invoiceStatus` 更新为 `issued`。
- 月结单资料归档复用现有 document store，关联 refId 为月结单号。

## 验证

- `npm run lint` 通过。
- `npm run build` 通过，构建清单包含 `/api/billing/statement` 和 `/api/ops/documents`。
- Playwright 本地渲染客户 `/billing/statements/2026-06`，页面可见“月结单确认”和“月结单 PDF / 付款资料归档”。
- Playwright 本地渲染运营 `/ops/billing/statements/DEMO/2026-06`，页面可见“月结单运营处理”和“月结单 PDF / 发票归档”。
- 客户提交付款缺少付款参考号时返回 400。
- 运营月结接口月份格式错误时返回 400。

## 下一步

- 生成真正的 PDF 文件并自动归档，而不是依赖浏览器打印后上传。
- 增加月结单付款账户信息、付款二维码或收款银行信息。
- 后续接入真实财务系统时，把 `paid`、`issued` 和付款参考号同步到外部账务。
