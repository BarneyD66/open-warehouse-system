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
