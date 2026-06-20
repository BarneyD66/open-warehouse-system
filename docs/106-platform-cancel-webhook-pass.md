# 106 平台取消订单 Webhook 闭环

本轮补齐平台订单 API 同步中的主动回传能力：平台取消/作废订单不再只能等下一次拉单识别，也可以通过 webhook 直接触发仓库截单和异常处理。

## 已完成

- 新增 `/api/webhooks/platforms/[platform]`：
  - 支持 Amazon、TikTok Shop、Shopify、eBay 等平台按路径区分。
  - 识别取消、作废、关闭类平台事件。
  - 支持 HMAC 签名校验和 legacy secret 校验。
  - 支持 10 分钟 replay 防重。
  - 支持按平台订单号、客户编号、店铺名匹配出库单。
- 自动处理逻辑：
  - 未发货订单：自动创建截单申请。
  - 已生成面单订单：先尝试取消承运商面单，再创建截单申请。
  - 已发货订单：创建物流/售后异常，提醒运营处理退回、赔付或客户沟通。
  - 每次成功处理都会写入审计日志。
- 更新平台集成就绪检查：
  - 增加 `PLATFORM_WEBHOOK_SECRET` 和 `${PLATFORM}_WEBHOOK_SECRET`。
  - 平台正式连接如果缺少 webhook 签名密钥，会被标记为待补齐。

## Webhook 示例

```http
POST /api/webhooks/platforms/shopify
Content-Type: application/json
X-Sheffield-Webhook-Timestamp: 1781770000000
X-Sheffield-Signature: sha256=<hmac>

{
  "event": "order_cancelled",
  "orderNo": "SHOPIFY-10086",
  "customerCode": "CUST-001",
  "storeName": "UK Store",
  "reason": "买家取消订单"
}
```

## 业务价值

- 平台取消订单后，仓库不需要等人工发现。
- 未发货订单可以尽快截单，降低错发和库存占用。
- 已发货订单会进入异常流程，避免客户沟通和赔付遗漏。
