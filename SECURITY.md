# Security Policy

## Supported Versions

Open Warehouse System is currently in the `0.x` stage. Security fixes are prioritized on `main` and will be included in the next tagged release when appropriate.

当前仓库仍处于 `0.x` 阶段。安全修复优先进入 `main` 分支，并在合适时进入下一个 release。

## Reporting a Vulnerability

Please do not open a public issue with exploit details, production secrets, customer data, warehouse addresses, database URLs, carrier credentials, payment proofs, or private pricing sheets.

Preferred reporting options:

- Use GitHub private vulnerability reporting or GitHub Security Advisories if enabled.
- If private reporting is not available, open a minimal public issue asking for a security contact without disclosing sensitive details.
- For dependency vulnerabilities, include the affected package name, version, advisory link, and whether the app is exploitable in the current code path.

请不要在公开 issue 中提交真实漏洞利用细节、生产密钥、客户资料、仓库地址、数据库连接串、承运商凭证、付款凭证或私密报价表。可以通过 GitHub Security Advisories 或私下联系维护者报告。

报告时请尽量包含：

- 影响的页面、API 或脚本
- 复现步骤
- 预期影响
- 建议修复方向

## Security Scope

High-priority areas:

- Customer data isolation by authenticated customer identity.
- Staff-only API protection and role checks.
- Session signing, cookie behavior, and password handling.
- File upload, document download, and proof-of-payment access control.
- CSV/Excel import and export safety.
- Billing, inventory adjustment, stocktake, return/RMA, and audit-log workflows.
- PostgreSQL schema, migration scripts, and local fallback store behavior.

Out of scope:

- Social engineering.
- Denial-of-service testing against public demos or maintainer infrastructure.
- Findings that require real customer data, real warehouse credentials, or production system access.
- Automated scanner output without a practical impact explanation.

## Data and Demo Policy

Public issues, pull requests, screenshots, and docs must use fake demo data only.

Do not commit:

- `.env.local`, production `.env` files, logs, local database dumps, or `.local-data`.
- Real customer names, phone numbers, emails, addresses, invoices, labels, payment proofs, or order files.
- Real warehouse addresses, carrier account details, API keys, tokens, or webhooks.
- Confidential pricing sheets or production screenshots.

Chinese-mode customer-facing exports and templates should keep Chinese headers and Chinese sample data. Internal English field aliases are acceptable when needed for integration.

## Production Checklist

- 设置强随机 `SESSION_SECRET`。
- 配置正式 `STAFF_WHITELIST_JSON`，不要使用默认开发账号。
- 生产环境关闭 `ALLOW_DEMO_LOGIN` 和 `ALLOW_DEMO_STAFF_LOGIN`。
- 使用托管 PostgreSQL，并限制数据库访问来源。
- 文件上传接入对象存储、权限校验和病毒扫描。
- 不提交 `.env.local`、`.local-data`、日志、测试产物和客户文件。

Related docs:

- `docs/STAFF_AUTH.md`: staff whitelist, demo login, and production authentication guidance.
- `docs/SECRET_HANDLING_CHECKLIST.md`: secret, credential, and production-data handling checklist.
- `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`: deployment environment, auth, data, and integration safety checklist.
- `docs/PRIVACY_DATA_RETENTION_GUIDE.md`: privacy and data-retention engineering checklist.
- `docs/DEMO_DATA_PLAN.md`: safe fake demo data guidance.
- `docs/SCREENSHOT_GUIDE.md`: safe screenshot and public demo media guidance.
- `docs/MAINTENANCE_PLAN.md`: maintainer triage and review process.
