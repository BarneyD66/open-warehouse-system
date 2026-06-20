# 104 通知投递自动重试端点

本轮把消息中心的失败通知重试从“运营手动触发”继续推进到“可接入定时任务自动恢复”。

## 已完成

- 新增 `/api/ops/notifications/deliveries/retry-due`：
  - 支持 `GET` 和 `POST`。
  - 支持 `Authorization: Bearer <secret>` 定时任务调用。
  - 密钥读取顺序：`NOTIFICATION_RETRY_SECRET`，其次 `CRON_SECRET`。
  - 也支持已登录的 `admin` / `ops` 员工手动调用。
  - 默认一次最多重试 50 条，接口最大限制 200 条。
  - 自动写入审计日志。
- 更新集成就绪检查：
  - 通知投递检查项增加 `NOTIFICATION_RETRY_SECRET` 和 `CRON_SECRET`。
  - 没有自动重试密钥时会给出下一步建议。
- 更新系统健康检查：
  - 外部通知投递检查会显示 webhook 和自动重试密钥是否配置。

## 建议接入方式

生产环境可以让 Vercel Cron 或外部调度器定时调用：

```http
GET /api/ops/notifications/deliveries/retry-due
Authorization: Bearer <CRON_SECRET 或 NOTIFICATION_RETRY_SECRET>
```

## 业务价值

- 供应商短暂故障后，失败通知可以自动恢复。
- 每次自动重试都有审计记录，老板和运营能看到是否真实执行。
- 上线体检会明确提示通知自动重试是否具备生产条件。
