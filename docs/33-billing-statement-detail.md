# 月结单详情与打印 MVP

## 本轮完成

- 客户新增月结单详情页：`/billing/statements/[month]`。
- 运营新增月结单详情页：`/ops/billing/statements/[customerCode]/[month]`。
- 客户 `/billing` 的月度对账卡片新增“查看月结单”入口。
- 运营 `/ops` 的月结锁账面板新增“查看月结单”入口。
- 月结单详情页展示月结单号、客户、月份、锁账状态、账单数量、总金额、待结算、已支付、争议/开票统计和逐条账单明细。
- 月结单详情页支持打印，浏览器打印时可保存为 PDF。
- 月结单详情页保留 CSV 导出入口，便于财务继续做 Excel 核对。

## 验证记录

- `npm run lint` 通过。
- `npm run build` 通过，构建路由包含 `/billing/statements/[month]` 和 `/ops/billing/statements/[customerCode]/[month]`。
- 本地客户 `/billing` 可渲染“查看月结单”入口。
- 本地客户 `/billing/statements/2026-06` 可渲染“客户月结单”、`STMT-DEMO-2026-06`、打印按钮、合计和 `BILL-UK-24001`。
- 本地运营 `/ops` 可渲染 `/ops/billing/statements/DEMO/2026-06` 入口。
- 本地运营 `/ops/billing/statements/DEMO/2026-06` 可渲染“运营月结单”、`STMT-DEMO-2026-06`、打印按钮和 `BILL-UK-24001`。

## 下一步建议

- 增加客户整月确认动作，客户确认后运营再锁账。
- 增加正式 Excel `.xlsx` 导出，保留格式和汇总公式。
- 对接发票 PDF 文件存储与邮件通知。
