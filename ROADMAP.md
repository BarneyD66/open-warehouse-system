# Roadmap

Open Warehouse System 的路线图围绕一个目标：让中小跨境仓储团队可以从开源版本开始，逐步走到可生产使用的 WMS/OMS/TMS 协同系统。

## 0.1 - Open-source Packaging

- 完成 README、License、Contributing、Security、Issue/PR 模板。
- 梳理本地运行、数据库初始化和部署说明。
- 提供 Codex for OSS 申请草稿。
- 建立公开 issue backlog，方便外部贡献者 star、fork 和认领任务。

## 0.2 - Developer Onboarding

- 增加 seed data 脚本。
- 增加 GitHub Actions：lint、build、basic smoke test。
- 补齐英文 README 摘要和架构图。
- 增加 Docker Compose 本地 PostgreSQL 启动方式。

## 0.3 - WMS Core Hardening

- 将更多本地 fallback store 持久化到 PostgreSQL。
- 完善客户数据隔离、员工 RBAC 和审计日志。
- 拆分入库、出库、库存、账单和退货领域服务。
- 增加关键流程 Playwright E2E。

## 0.4 - Warehouse Operations

- 移动端仓库作业体验优化。
- 扫码收货、扫码上架、扫码拣货和库位校验。
- 批量导入/导出增强。
- 打印模板支持 PDF/ZPL。

## 0.5 - Carrier and Billing Integrations

- 真实承运商 API 适配层。
- 运费试算、面单购买、轨迹 webhook 回传。
- 账单锁定、对账、导出和付款复核增强。
- 对接对象存储、文件预览和权限水印。

## Long Term

- 多仓、多币种、多语言。
- 插件式承运商、平台订单和财务系统适配。
- 面向 3PL 的多租户部署模板。
- 更完整的开放 API 和事件系统。
