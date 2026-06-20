# 74. 退货/RMA保存视图报表

## 本轮目标

把退货/RMA报表接入运营后台的保存视图体系，让运营可以像马帮常用列表一样保存筛选口径并重复导出。

## 已完成

- 保存视图模块新增 `returns` 类型。
- `/api/ops/reports/views/[id]` 支持把退货视图跳转到 `/api/ops/reports/returns`。
- 退货报表识别 `auditSource=saved_view`，避免保存视图导出重复写审计日志。
- 运营“高级筛选、保存视图与运营报表”区增加“导出退货待确认”快捷入口。
- 保存视图表单的报表模块下拉增加“退货/RMA”。

## 推荐保存视图

- 退货待客户确认：`returnStatus=needs-decision`
- 未补买家追踪号：`returnStatus=missing-tracking`
- 退货质检中：`returnStatus=inspection`
- 某客户退货：`returnQuery=CUST-xxxx`

## 价值

客户售后、仓库质检和运营客服可以围绕固定筛选口径协作，老板也可以直接导出相同口径的退货报表，减少反复解释“当前列表为什么和报表不一样”。
