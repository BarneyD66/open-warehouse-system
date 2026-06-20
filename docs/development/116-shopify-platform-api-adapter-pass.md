# 116 Shopify 平台订单 API 适配

## 本轮目标

把平台订单 API 同步从“通用 POST 网关”继续推进到更接近真实平台的适配层，先落地 Shopify 这个常见独立站平台。

## 已落地

- `platformGateway` 新增 Shopify live 拉单：
  - 支持 `SHOPIFY_API_BASE_URL=https://your-store.myshopify.com`。
  - 支持 `SHOPIFY_ACCESS_TOKEN` / `SHOPIFY_API_TOKEN`。
  - 支持多店铺 `credentialRef=SHOPIFY_STORE_A`，读取：
    - `SHOPIFY_STORE_A_API_BASE_URL`
    - `SHOPIFY_STORE_A_ACCESS_TOKEN`
    - `SHOPIFY_STORE_A_API_TOKEN`
  - 调用 Shopify Admin REST 订单列表接口，拉取未履约订单。
  - 将 Shopify `line_items`、`shipping_address`、`shipping_lines` 转成系统统一订单导入行。
- `platformGateway` 新增 Shopify 发货追踪号回传：
  - 先获取订单的 `fulfillment_orders`。
  - 再创建 fulfillment，并回传 tracking number、承运商和出库单号。
- 运营后台平台连接表单新增“API 配置备注”：
  - 直接提示 Shopify 正式 API 的环境变量配置方式。
  - 支持多店铺 credentialRef 配置说明。
- 生产集成检查补充 credentialRef 相关环境变量：
  - 独立 API Token
  - 独立访问令牌
  - 独立 API 基础地址

## 配置示例

单 Shopify 店铺：

```text
SHOPIFY_API_BASE_URL=https://your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxx
SHOPIFY_API_VERSION=2026-01
```

多 Shopify 店铺：

```text
SHOPIFY_STORE_A_API_BASE_URL=https://store-a.myshopify.com
SHOPIFY_STORE_A_ACCESS_TOKEN=shpat_xxx
```

平台连接备注填写：

```text
credentialRef=SHOPIFY_STORE_A
```

## 验证

- `npm run lint`
