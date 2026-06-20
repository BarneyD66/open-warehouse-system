# 111 - 承运商 POD Webhook 自动回传

## 本轮目标

补齐物流闭环里“承运商已签收并回传签收证明”的自动处理，避免客户侧只看到已签收，但签收证明下载表没有可用入口。

## 已完成

- 承运商 webhook 支持更多 POD 字段别名：
  - `proofUrl`
  - `proof_url`
  - `podUrl`
  - `pod_url`
  - `pod`
  - `proof`
  - `signatureUrl`
  - `signature_url`
- 当 webhook 状态为 `delivered` 且带签收证明链接时，系统自动创建 `proof_uploaded` 签收证明记录。
- 自动记录为 warning 级别，不阻塞出库单。
- 自动去重：同一出库单已有相同 POD 链接或已有签收证明记录时，不重复生成。
- 客户侧既有能力会自动复用：
  - `/api/outbounds/[id]/proof` 可跳转下载签收证明。
  - `/api/downloads?kind=proofs` 的签收证明清单可列出证明入口。
  - 物流异常与赔付下载表可展示签收证明链接。

## 验证

- `npm run lint` 通过。
- `npm run build` 通过。
- 构建路由保持包含 `/api/webhooks/carriers/[provider]` 和 `/api/outbounds/[id]/proof`。

