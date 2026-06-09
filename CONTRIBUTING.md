# Contributing

谢谢你愿意参与 Open Warehouse System。这个项目希望保持中文业务语境清晰，同时让英文读者也能理解系统结构。

## 开发流程

1. Fork 仓库并创建 feature branch。
2. 安装依赖：`npm install`。
3. 复制环境变量：`cp .env.example .env.local`。
4. 本地开发：`npm run dev`。
5. 提交前运行：`npm run lint` 和 `npm run build`。

## 贡献优先级

- P0：修复安全问题、数据隔离、构建失败、明显业务闭环错误。
- P1：补齐 PostgreSQL 持久化、测试覆盖、部署文档、真实仓储流程。
- P2：优化视觉、移动端、扫码、承运商集成、多语言和分析报表。

## 适合新贡献者的任务

优先选择范围小、验证方式明确、不会接触真实客户数据的任务：

- 补充英文说明、部署说明、截图说明或贡献者 onboarding。
- 改进 fake demo data、seed data 文档或本地启动说明。
- 给客户、运营、仓库流程补 Playwright smoke test。
- 修正文案、空状态、移动端布局或无障碍标签。
- 改进 CSV/Excel 模板说明，但客户可见中文模式必须保持中文表头和中文示例。

如果要创建新手任务，可以使用 `.github/ISSUE_TEMPLATE/good_first_issue.md`，写清楚目标文件、验收标准和验证命令。

## 文案和本地化

客户可见内容默认中文优先。CSV/Excel 模板、示例数据和页面文案也应保持中文优先；如果接口需要英文系统字段，请把英文别名留在内部实现中。

## Pull Request 要求

- 描述业务场景和影响范围。
- 写清楚如何验证。
- 不提交 `.env.local`、真实客户数据、生产截图、数据库连接串或密钥。
- UI 改动请附截图，最好覆盖桌面端和移动端。

## Commit 建议

可以使用简洁的前缀：

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `test:` 测试
- `chore:` 配置或维护
