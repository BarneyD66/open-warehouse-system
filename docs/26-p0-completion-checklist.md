# P0 完成清单

## 已完成

- 官网首页、服务页、费用页核心文案已调整为“英国仓配 + 自营系统 + 中文客服”方向。
- AI 已降级为辅助入口，不再作为首屏核心卖点。
- 询盘表单支持尾程派送需求，并沉淀到运营后台。
- 报价草稿、客户确认报价、客户提出报价问题已形成闭环。
- 询盘和入库预报均有状态时间线。
- 入库预报已升级为 ASN 形态，支持基础字段、资料清单、SKU 明细行。
- 入库资料 checklist 已支持装箱单、SKU 清单、外箱标签、追踪号、标签文件、授权资料、图片等判断。
- 客户可补交资料，补交后写入 ASN 时间线。
- ASN 支持运营状态推进：已提交、资料审核、资料通过、预约、到仓、收货、上架、异常、关闭、取消。
- 客户门户、费用页、查进度页按客户账号过滤数据。
- 运营后台可查看全量询盘、报价、ASN、资料缺口、SKU 明细和状态推进。

## PostgreSQL 存储

- 运行时数据存储已从 `.local-data/submissions.json` 替换为 PostgreSQL。
- PostgreSQL 表结构位于 `db/schema.sql`。
- 本地初始化脚本：`npm run db:init`。
- 本地 JSON 原型数据迁移脚本：`npm run db:migrate:local`。
- 已保留并落库 `customerCode`、`StatusEvent`、`quoteDraft`、`quoteResponse`、`skuLines`、`InboundStatus` 等结构。
- 线上发版前必须在 Vercel 配置 `POSTGRES_URL` 或 `DATABASE_URL`，否则提交、查询、客户门户和运营后台接口无法访问数据库。

## 验证

- `npm run lint` 需要在每次发版前执行。
- `npm run build` 需要在每次发版前执行。
- 客户账号隔离验证：`test / test` 与 `blue / test` 登录后只看到对应客户数据。
- ASN SKU 明细验证：追踪接口显示明细数量，运营后台显示 SKU 表格。
- ASN 状态推进验证：运营更新状态后，查进度时间线同步更新。
