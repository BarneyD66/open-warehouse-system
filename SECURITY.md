# Security Policy

## Supported Versions

当前仓库仍处于 `0.x` 阶段。安全修复优先进入 `main` 分支。

## Reporting a Vulnerability

请不要公开提交真实漏洞利用细节、生产密钥、客户资料或数据库连接串。可以通过 GitHub Security Advisories 或私下联系维护者报告。

报告时请尽量包含：

- 影响的页面、API 或脚本
- 复现步骤
- 预期影响
- 建议修复方向

## Production Checklist

- 设置强随机 `SESSION_SECRET`。
- 配置正式 `STAFF_WHITELIST_JSON`，不要使用默认开发账号。
- 生产环境关闭 `ALLOW_DEMO_LOGIN` 和 `ALLOW_DEMO_STAFF_LOGIN`。
- 使用托管 PostgreSQL，并限制数据库访问来源。
- 文件上传接入对象存储、权限校验和病毒扫描。
- 不提交 `.env.local`、`.local-data`、日志、测试产物和客户文件。
