# 客户补资料流程交付记录

## 市场团队交接

市场团队继续把客户侧需求交给产品经理：客户门户已经能看到“待补资料”和“待补追踪号”，但按钮必须能继续往下走，不能只是展示。

产品经理把本轮目标定为：补资料自助化。

## 已完成

- 新增 `/supplement` 页面。
- 新增 `/api/supplements` 接口。
- 本地存储新增 `supplementInbound()`，可按 ASN 更新：
  - 承运商 / 追踪号
  - 附件名称
  - 补充说明
  - 更新时间
- `/api/supplements` 已支持 `multipart/form-data`，真实文件会保存到 `.local-data/uploads/<ASN>/`。
- `/portal` 待办按钮已接到 `/supplement?asn=...`。
- 顶部导航新增“补交资料”入口。

## 当前原型边界

当前版本已经支持本地真实文件上传，但还没有做生产级文件治理。正式版需要接入：

- 对象存储或私有文件服务
- 文件大小、类型、病毒扫描和过期清理
- 客户身份校验
- 文件权限
- 客服审核状态
- 仓库后台任务提醒

## 验证

- `npm run lint` 通过。
- `npm run build` 通过。
- 构建中新增 `/api/supplements` 和 `/supplement`。
- Playwright 验证 `/supplement?asn=ASN-UK-202605-2742` 可预填 ASN。
- 提交追踪号 `DHL-UPLOAD-8899` 并上传 `packing-list-test.txt` 后，本地记录、`.local-data/uploads/` 和 `/portal` 均能看到更新结果。
- 390px 移动端无页面级横向滚动。
