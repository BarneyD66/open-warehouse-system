## Summary

请简要说明这个 PR 做了什么。

## Business Flow

影响的业务流程：

- [ ] 官网/询盘
- [ ] 客户门户
- [ ] 运营后台
- [ ] 仓库作业
- [ ] SKU/库存
- [ ] 出库/物流
- [ ] 退货/RMA
- [ ] 账单/文件
- [ ] 文档/配置

## Verification

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] 手动验证：

## Screenshots

如有 UI 改动，请按 `docs/SCREENSHOT_GUIDE.md` 附截图。

- [ ] 桌面端截图
- [ ] 移动端截图
- [ ] 截图只使用 fake demo data
- [ ] 截图未暴露 `.env.local`、密钥、真实客户资料、仓库地址、承运商账号、付款凭证或报价表

## Risk Notes

请说明数据权限、生产配置、迁移、兼容性或回滚风险。

- [ ] 客户数据仍按客户身份隔离
- [ ] 员工专用 API 仍需要员工登录态
- [ ] 中文模式下客户可见 CSV/Excel 模板、导出表头和示例数据仍保持中文优先
