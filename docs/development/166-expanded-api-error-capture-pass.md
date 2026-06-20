# 166 扩展生产 API 异常捕获

## 本轮目标

把生产使用频率高、且一旦异常会直接影响客户/仓库/集成闭环的入口接入统一错误捕获，保证非业务校验类异常会进入生产错误台账，并返回可追踪的 `errorId`。

## 已覆盖接口

- 客户资料文件：`/api/documents`
  - 文件列表
  - 文件上传
- 文件访问：`/api/documents/[id]/download`、`/api/documents/[id]/preview`
  - 安全下载
  - 在线预览
- 客户出库：`/api/outbounds`
  - 出库列表
  - 模板下载
  - CSV 导入预览/草稿/提交
  - 手工提交出库
- 仓库扫码：`/api/warehouse/scan`
  - 采购收货/上架扫码
  - 退货收货/质检扫码
  - 出库拣货/分拣/打包/发货/截单扫码
- 外部回传：`/api/webhooks/carriers/[provider]`、`/api/webhooks/platforms/[platform]`
  - 承运商轨迹/签收/派送异常 webhook
  - 平台取消/作废订单 webhook

## 产品效果

- 业务校验错误仍按原逻辑返回，例如未登录、签名失败、重复 webhook、订单未匹配、扫码业务异常。
- 未预期系统异常会被记录到生产错误中心，返回统一提示和错误编号。
- 错误中心可继续与告警、系统日志、审计日志一起用于定位生产问题。

## 验证

- 已通过 `npm run lint`
- 已通过 `npm run build`
- 已通过冲突标记扫描
- 已通过 BOM 扫描
