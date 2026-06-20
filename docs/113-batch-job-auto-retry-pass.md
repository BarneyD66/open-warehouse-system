# 113 - 批量任务队列自动重试

## 本轮目标

继续补齐生产运维能力，把批量任务队列从“异常后只能人工单条重试”推进到“可由 Cron 或运营批量触发自动恢复”。

## 已完成

- 新增 `/api/ops/jobs/retry-due`：
  - 支持 `GET` 和 `POST`。
  - 支持管理员和运营角色手动触发。
  - 支持 `Authorization: Bearer <secret>` 或 `?secret=` 的定时任务调用。
  - 密钥读取顺序：`JOB_RETRY_SECRET`，其次 `CRON_SECRET`。
  - 默认最多处理 50 个到期异常任务。
  - 未超过最大重试次数的异常任务会重新进入队列，并设置下一次执行时间。
  - 可选 `includeQueued=1` 用于查看已到期队列任务，但不会重复重试已经排队的任务。
- 新增审计动作 `batch_job_retry_due`：
  - 记录扫描任务数、处理数、重新排队数、失败数和逐条结果。
  - 审计日志导出和前端审计面板显示中文“到期任务批量重试”。
- 运营后台“批量作业中心”新增按钮：
  - “重试到期异常任务”
  - 运营可以在后台直接批量恢复异常任务。
- 生产健康检查增强：
  - 任务队列会检查 `JOB_RETRY_SECRET` 或 `CRON_SECRET`。
  - 如果没有自动重试密钥，即使当前无异常任务，也会标为“降级”，提醒上线前补齐。
- 生产集成体检增强：
  - 生产运行安全检查新增 `JOB_RETRY_SECRET` 和 `CRON_SECRET`。
  - 下一步提示会引导调度器调用 `/api/ops/jobs/retry-due`。

## 验证

- `npm run lint` 通过。
- `npm run build` 通过。
- 构建路由已包含 `/api/ops/jobs/retry-due`。

## 后续建议

- 在 Vercel Cron 或外部调度器配置：
  - URL：`/api/ops/jobs/retry-due`
  - Header：`Authorization: Bearer <JOB_RETRY_SECRET 或 CRON_SECRET>`
- 后续可继续补“真正的批量任务执行器”，按任务类型自动执行 SKU 导入、追踪号导入、批量导出等作业。

