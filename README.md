# Open Warehouse System

[English README](README.en.md) | 中文说明

中文优先的开源仓储管理系统 Starter，面向跨境电商、海外仓、3PL 和自营仓配团队。项目覆盖官网获客、客户自助门户、运营后台、仓库作业台、库存、入库、出库、账单、退货和物流轨迹等核心流程，适合作为轻量 WMS / OMS / TMS 一体化系统的参考实现。

> English: an open-source WMS starter for cross-border warehouse operations, fulfillment, inventory, billing, returns, and customer self-service workflows.

![Open Warehouse System preview](public/assets/uk-warehouse-brand-hero.png)

## 为什么开源

很多中小跨境团队需要的不是一套沉重 ERP，而是一个能快速跑通真实业务闭环的仓储系统底座。本项目把海外仓常见流程拆成可读、可改、可部署的 Next.js + PostgreSQL 应用，希望给以下团队一个可复制的起点：

- 中国跨境卖家、英国/欧洲海外仓和 3PL 服务商
- 想从表格、微信群和人工对账迁移到结构化系统的运营团队
- 正在学习 WMS、履约、库存流水、账单复核和退货质检流程的开发者
- 需要一个中文业务语境下的 SaaS / Ops 后台样板项目的团队

## 核心能力

- 官网和获客页：服务介绍、报价入口、询盘表单、费用说明、帮助中心
- 客户门户：注册登录、客户资料、询盘、入库预报、SKU、出库、退货、账单、文件资料
- 运营后台：询盘跟进、报价草稿、客户审核、入库/出库推进、账单复核、异常和待办
- 仓库作业台：入库收货、上架、出库拣货、打包复核、交运、库位和打印页
- 库存底座：SKU 档案、库存余额、库存流水、库存调整审批、盘点和补货规划
- 物流与账单：承运商规则、运费试算、面单/追踪号、账单确认、付款凭证和异议处理
- 数据层：本地 JSON fallback + PostgreSQL schema，便于从 demo 过渡到正式数据库
- 验证材料：已有 lint/build/Playwright 验证记录和产品文档沉淀在 `docs/`

## 技术栈

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- PostgreSQL via `postgres`
- Playwright for browser verification
- Vercel-friendly deployment

## 快速开始

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。

常用入口：

- `/` 官网首页
- `/login` 客户登录和注册
- `/portal` 客户工作台
- `/ops-login` 员工登录
- `/ops` 运营后台
- `/warehouse` 仓库作业台
- `/tracking` 业务追踪

开发环境会使用本地演示登录能力。生产环境请配置 `SESSION_SECRET`、`STAFF_WHITELIST_JSON`、`POSTGRES_URL` 或 `DATABASE_URL`，并关闭演示登录开关。

## 数据库

项目可以先用本地 `.local-data` 运行，也可以接入 PostgreSQL。

```bash
npm run db:init
npm run db:migrate:local
```

Schema 位于 `db/schema.sql`。本地 JSON 到 PostgreSQL 的迁移脚本位于 `scripts/migrate-local-json-to-postgres.mjs`。

## 文档索引

- `docs/31-mvp-current-status.md`：当前 MVP 状态和验证记录
- `docs/25-self-operated-wms-prd.md`：自营仓储系统一期 PRD
- `docs/27-postgres-migration.md`：PostgreSQL 迁移说明
- `docs/35-launch-readiness-hardening.md`：上线前安全和配置检查
- `docs/STAFF_AUTH.md`：员工白名单、demo 登录和生产认证配置说明
- `SECURITY.md`：漏洞报告、安全范围和公开数据处理政策
- `CHANGELOG.md`：公开版本记录和 release notes 摘要
- `docs/CODEX_FOR_OSS_APPLICATION.md`：Codex for OSS 申请草稿
- `docs/OPEN_SOURCE_LAUNCH_CHECKLIST.md`：公开仓库发布清单
- `docs/GITHUB_REPO_PROFILE.md`：GitHub About、topics 和 release 文案
- `docs/INITIAL_ISSUES.md`：公开后可复制的首批 issues
- `docs/STAR_AND_FORK_MESSAGE.md`：发给朋友帮忙 star/fork 的短文案
- `docs/ARCHITECTURE.md`：系统架构和边界说明
- `ROADMAP.md`：开源路线图

## 适合贡献的方向

- 更完整的 PostgreSQL 持久化和种子数据
- 仓库作业移动端体验和扫码流程
- 真实承运商 API、PDF/ZPL 面单和 webhook 回传
- 多语言文案、英文文档和部署教程
- RBAC、审计、文件存储和生产安全加固
- Playwright 端到端测试和 GitHub Actions CI

## 开源协议

MIT License。你可以自由使用、修改和二次开发，但请不要提交真实客户资料、真实仓库地址、密钥或生产数据库连接串。
