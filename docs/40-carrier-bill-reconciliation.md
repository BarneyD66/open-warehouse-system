# 承运商账单导入与运费核对

Date: 2026-05-27

## 对标马帮缺口

马帮物流和财务协同里，承运商账单不能只靠单票手工填写。运营需要把 Royal Mail、DPD、Evri、DHL 等承运商账单批量导入，系统按追踪号或出库单号匹配出库单，自动写回实际运费，并统计预估运费和实际运费差异。

## 本轮完成

- 新增承运商账单导入模板：`/api/ops/mabang-modules?template=carrier-bill`。
- 新增运营导出：`/api/ops/mabang-modules?export=carrier-bills`。
- 新增账单导入批次模型 `CarrierBillImportBatch` 和行级结果 `CarrierBillImportRow`。
- 新增 `importCarrierBillCsv`：
  - 支持按追踪号匹配出库单。
  - 支持无追踪号时按出库单号匹配。
  - 自动把实际运费写回出库单。
  - 自动计算实际运费和预估运费差异。
  - 记录匹配行、跳过行、差异行和账单总额。
  - 差异达到 £1 时自动生成“账单争议”工单，差异达到 £5 时标记为紧急。
- 运营后台物流配置区新增“承运商账单导入与运费差异核对”面板。
- 新增 `/ops/carrier-bills/[id]` 行级详情页，可查看每一行匹配状态、预估运费、实际运费、差异和未匹配原因。
- 详情页支持导出行级核对明细：`/api/ops/mabang-modules?batchId=...&report=carrier-bill-detail`。
- 修复批量文本拆分逻辑，避免把问号误当作分隔符。
- 清理平台订单导入模板函数的重复返回。

## 模板字段

| 字段 | 说明 |
| --- | --- |
| 追踪号 | 优先用于匹配出库单 |
| 出库单号 | 追踪号为空时作为匹配依据 |
| 承运商 | 例如 Royal Mail、DPD、Evri |
| 服务名称 | 例如 Tracked 48、Next Day |
| 实际运费 | 承运商账单金额 |
| 币种 | 默认 GBP |
| 账单日期 | 承运商出账日期 |
| 备注 | 账单行备注 |

## 验证

- `npm run lint` 通过；仅保留既有教程截图脚本未使用函数 warning。
- `npm run build` 通过，构建清单包含 `/api/ops/mabang-modules` 和 `/ops`。

## 下一步

- 后续接入真实承运商 API 后，把账单文件导入升级为 API 自动拉账单。
- 将账单争议工单和月结账单调整审批进一步联动。
