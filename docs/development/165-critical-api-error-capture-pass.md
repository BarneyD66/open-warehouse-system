# 165 关键 API 自动错误捕获

## 背景

生产错误台账和处理闭环已经可用，但只有少量入口会主动写入错误事件。本轮把高风险生产 API 接入统一错误捕获，让未预期异常自动进入生产错误台账、生产日志、系统告警和健康检查。

## 已完成

- 新增 `withApiErrorCapture` helper：
  - 包裹 API handler。
  - 未预期异常会写入 `productionErrorStore`。
  - 返回统一中文错误文案和 `errorId`。
  - 保留原有业务校验返回，不改变 400/401/403/429 等正常业务分支。
- 接入高风险 API：
  - `/api/ops/outbounds/[id]/shipping`
    - 覆盖运费试算、真实/沙箱面单生成、取消面单、人工面单、平台发货回传重试、承运商轨迹/POD 主动同步。
  - `/api/ops/platform-orders/sync-due`
    - 覆盖平台订单定时/手动同步。
  - `/api/ops/carrier-labels/retry-due`
    - 覆盖承运商面单批量重试。
  - `/api/ops/system/backup`
    - 覆盖系统备份导出。
  - `/api/ops/system/restore`
    - 覆盖系统恢复预检和正式恢复。

## 验收点

- 上述 API 出现未预期异常时会返回 `errorId`。
- 错误事件进入生产日志检索的“生产错误”来源。
- 开放错误会进入系统告警和生产健康检查。
- 原有业务错误返回保持不变，不会把正常校验失败误记为 500。

## 下一步

- 继续接入更多关键 API：文件上传/预览下载、客户提交出库、仓库扫码、平台/承运商 webhook。
- 为前端运行时异常增加客户端上报入口。
