# 114 批量任务执行器闭环

## 本轮目标

把批量作业从“人工改状态 + 异常重试”推进到可自动执行的队列闭环，方便后续接入 Vercel Cron 或外部调度器。

## 已落地

- 新增 `/api/ops/jobs/run-due`：
  - 支持员工登录调用，也支持 `JOB_RUN_SECRET` 或 `CRON_SECRET` 作为系统调度密钥。
  - 自动扫描到期且仍在队列中的批量任务。
  - 执行前将任务置为 `processing`，执行后写入 `completed` 或 `exception`。
  - 生成审计日志 `batch_job_run_due`，记录本次处理、完成和失败数量。
- 已支持真实执行的任务：
  - `picking_wave`：自动选择尚未生成拣货波次、未发货、未阻塞的出库单，调用现有 `batchGenerateOutboundPickWaves` 生成波次和拣货单。
- 已做清晰失败提示的任务：
  - `sku_import`
  - `inbound_import`
  - `location_move`
  - `weighing`
  - `tracking_upload`
  - `export`
  - 这些任务当前队列记录只有元数据，没有原始文件或执行条件，因此不会假完成，会标记异常并提示员工需要重新上传模板或在报表中心执行。
- 运营后台“批量作业中心”新增“执行到期任务”按钮。
- 生产集成检查加入 `JOB_RUN_SECRET`。
- 系统健康检查的任务队列状态开始同时关注“自动执行密钥”和“自动重试密钥”。

## 生产配置建议

正式环境建议配置：

```text
JOB_RUN_SECRET=一段足够长的随机密钥
JOB_RETRY_SECRET=一段足够长的随机密钥
```

如果统一使用调度密钥，也可以只配置：

```text
CRON_SECRET=一段足够长的随机密钥
```

调度器调用：

```text
POST /api/ops/jobs/run-due
Authorization: Bearer <JOB_RUN_SECRET 或 CRON_SECRET>
```

异常重排调用：

```text
POST /api/ops/jobs/retry-due
Authorization: Bearer <JOB_RETRY_SECRET 或 CRON_SECRET>
```

## 验证

- `npm run lint`
- `npm run build`
