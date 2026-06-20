# 117 承运商轨迹/POD 主动同步

## 本轮目标

补齐真实承运商闭环里的“主动拉取轨迹和签收证明”能力。Webhook 不稳定或承运商延迟推送时，运营可以在出库单上手动同步最新轨迹和 POD。

## 已落地

- `carrierGateway` 新增 `fetchCarrierTrackingAndProof`：
  - 支持通过承运商配置匹配 Royal Mail、DPD、Evri 等渠道。
  - 支持 `credentialRef` 独立变量。
  - 支持以下环境变量：
    - `${credentialRef}_TRACKING_URL`
    - `${credentialRef}_PROOF_URL`
    - `${PROVIDER}_TRACKING_URL`
    - `${PROVIDER}_PROOF_URL`
    - `${credentialRef}_BASE_URL`
    - `${PROVIDER}_CARRIER_GATEWAY_URL`
  - 兼容返回字段：`status`、`trackingStatus`、`detail`、`location`、`trackingNumber`、`carrierShipmentId`、`proofUrl`、`podUrl`。
- `/api/ops/outbounds/[id]/shipping` 新增动作 `sync_tracking`：
  - 主动调用承运商轨迹/POD 网关。
  - 更新出库单轨迹节点。
  - 如果返回已签收且带 POD 链接，自动创建“签收证明”记录。
  - 写入 `outbound_shipping_label_update` 审计。
- 运营后台出库发货面板新增“同步轨迹/POD”按钮。
- 生产集成检查新增承运商轨迹/POD 地址提示。

## 配置示例

使用统一承运商网关：

```text
ROYAL_MAIL_LIVE_BASE_URL=https://carrier-gateway.example.com/royal-mail
ROYAL_MAIL_API_KEY=xxx
```

使用独立轨迹/POD 地址：

```text
ROYAL_MAIL_TRACKING_URL=https://carrier-gateway.example.com/royal-mail/tracking
ROYAL_MAIL_PROOF_URL=https://carrier-gateway.example.com/royal-mail/proof
ROYAL_MAIL_API_KEY=xxx
```

多渠道凭证引用：

```text
RM_MAIN_TRACKING_URL=https://carrier-gateway.example.com/rm/tracking
RM_MAIN_PROOF_URL=https://carrier-gateway.example.com/rm/proof
RM_MAIN_API_KEY=xxx
```

物流渠道配置里填写：

```text
credentialRef=RM_MAIN
```

## 验证

- `npm run lint`
- `npm run build`
