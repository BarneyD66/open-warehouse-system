# 167 Amazon 与 TikTok Shop 平台 API 适配

## 本轮目标

继续补齐对标马帮后的“平台订单 API 同步”能力，把原来主要依赖通用平台网关的 Amazon、TikTok Shop，推进为可配置、可拉单、可取消复核、可回传发货追踪号的专用适配。

## 已完成

- `platformGateway` 增强通用订单解析：
  - 支持 `orders`、`Orders`、`order_list`、`orderList`、`packages`、`data_list` 等常见平台返回结构。
  - 支持从 `payload`、`data`、`result`、`response` 嵌套结构中提取订单列表。
  - 支持更多平台明细字段，如 `OrderItemsList`、`productList`、`package_items`。
- 新增 Amazon SP-API 适配：
  - 支持按 `AMAZON_ACCESS_TOKEN`、`AMAZON_API_TOKEN` 或 `credentialRef` 读取访问令牌。
  - 支持 `AMAZON_API_BASE_URL`、`AMAZON_ORDERS_URL`、`AMAZON_FULFILLMENT_URL` 或多店铺 `credentialRef` 覆盖。
  - 拉单时归一化 `AmazonOrderId`、`OrderStatus`、`ShippingAddress`、`OrderItems`、`SellerSKU`、`QuantityOrdered`。
  - 识别 Amazon 取消订单并进入现有平台取消复核链路。
  - 发货回传支持专用请求头和可配置网关地址。
- 新增 TikTok Shop 适配：
  - 支持按 `TIKTOK_SHOP_ACCESS_TOKEN`、`TIKTOK_SHOP_API_TOKEN` 或 `credentialRef` 读取访问令牌。
  - 支持 `TIKTOK_SHOP_API_BASE_URL`、`TIKTOK_SHOP_ORDERS_URL`、`TIKTOK_SHOP_FULFILLMENT_URL` 或多店铺 `credentialRef` 覆盖。
  - 拉单时归一化 `order_id`、`order_status`、`recipient_address`、`productList`、`seller_sku`、`quantity`。
  - 识别 TikTok Shop 取消订单并进入现有平台取消复核链路。
  - 发货回传支持专用请求头和可配置网关地址。
- 更新生产集成就绪检查：
  - Amazon 增加 `AMAZON_MARKETPLACE_ID`、`AMAZON_SELLER_ID` 检查提示。
  - TikTok Shop 增加 `TIKTOK_SHOP_APP_KEY`、`TIKTOK_SHOP_SHOP_ID` 检查提示。
  - 对 Amazon/TikTok 正式联调明确提示建议通过签名网关暴露订单拉取和发货回传地址。
- 更新运营后台平台配置提示：
  - 在平台连接备注默认文案中加入 Amazon、TikTok Shop、Shopify、eBay 的环境变量配置示例。

## 产品效果

- 运营可以把 Amazon、TikTok Shop、Shopify、eBay 都配置为 API 型连接。
- 自动同步任务可以调用平台专用适配层，把订单转成统一导入预检草稿。
- 平台取消订单可以继续进入现有取消复核、截单、异常工单链路。
- 出库发货后可以继续复用现有平台发货追踪号回传和失败重试链路。

## 验证

- 已通过 `npm run lint`
- 已通过 `npm run build`
- 已通过冲突标记扫描
- 已通过 BOM 扫描
