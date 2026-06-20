# 107 整体检查与 Webhook 生产安全加固

本轮按上线前体检思路，对最近补齐的通知、平台 webhook、生产运维能力做了一轮整体检查。

## 检查发现

- `npm run lint` 通过。
- 新增通知、平台 webhook 相关文件没有发现明显中文乱码残留。
- `mock/example.com` 命中主要来自历史文档、邮箱占位和物流轨迹导入模板示例，不属于新功能运行时假数据。
- 检查到一个生产安全风险：
  - 承运商 webhook 和平台 webhook 在未配置密钥时会接受 unsigned 请求。
  - 这适合本地联调，但生产环境不应允许。

## 已修复

- `/api/webhooks/carriers/[provider]`：
  - 本地/开发环境可以 unsigned 联调。
  - 生产环境必须配置 `CARRIER_WEBHOOK_SECRET` 或 `${PROVIDER}_WEBHOOK_SECRET`。
- `/api/webhooks/platforms/[platform]`：
  - 本地/开发环境可以 unsigned 联调。
  - 生产环境必须配置 `PLATFORM_WEBHOOK_SECRET` 或 `${PLATFORM}_WEBHOOK_SECRET`。

## 结果

- 生产环境不会再接受未签名的平台取消订单或承运商轨迹回传。
- 上线前仍可通过集成就绪检查看到缺少的 webhook 密钥。
