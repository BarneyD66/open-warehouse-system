# 160 出库拣货波次自动生成

## 背景

系统已有手动批量生成拣货波次、波次效率报表和批量任务执行能力。本轮补齐仓库日常更常用的“一键自动组波次”：无需先人工选择订单或创建批量任务，系统直接扫描待拣订单并按策略生成波次。

## 本轮完成

- 新增 API：
  - `GET/POST /api/ops/outbounds/pick-waves/auto-generate`
  - 支持 `admin`、`ops`、`warehouse` 员工调用。
  - 支持 `OUTBOUND_PICK_WAVE_AUTO_SECRET`、`JOB_RUN_SECRET` 或 `CRON_SECRET` 定时调用。
- 自动选择候选订单：
  - 未生成波次/拣货单。
  - 未发货、未阻塞、未交接、未进入包装复核。
  - 未处于截单流程。
  - 有 SKU 明细。
  - 支持 `limit` 和 `minAgeMinutes`。
- 自动生成波次：
  - 复用 `batchGenerateOutboundPickWaves`。
  - 支持按承运商、渠道、截单时间、库区、SKU 热度、作业模式或单一波次分组。
  - 写入波次号、拣货单号、篮号/格口、拣货员和操作日志。
- 接入生产自动化：
  - `/api/ops/automation/run-due` 增加 `outbound_pick_wave_auto` 子任务。
  - `/api/ops/automation/task-actions` 支持失败重试。
  - 自动化摘要支持候选数、更新订单数、波次数。
- 运营页面增强：
  - 出库批量处理面板新增 `自动组波次` 按钮。
  - 不需要先勾选订单，系统自动扫描候选订单。
- 审计留痕：
  - 复用 `outbound_pick_wave_batch` 审计动作。
  - 记录候选订单、更新订单、生成波次、跳过原因和分组策略。

## 价值

仓库每天开工或截单前，运营/仓库可以一键把待拣订单按承运商或其他策略分成波次，减少人工筛单和漏单，提升拣货启动效率。
