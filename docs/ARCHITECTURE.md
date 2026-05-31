# Architecture

Open Warehouse System 是一个基于 Next.js App Router 的单体应用。当前目标不是追求复杂微服务，而是先把跨境仓储团队最常见的业务闭环放进一个可读、可部署、可迭代的代码库。

## High-level Flow

```mermaid
flowchart LR
  Visitor["官网访客"] --> Inquiry["询盘 / 报价"]
  Customer["客户"] --> Portal["客户门户"]
  Portal --> Inbound["入库 ASN"]
  Portal --> SKU["SKU 档案"]
  Portal --> Outbound["出库申请"]
  Portal --> Return["退货 RMA"]
  Portal --> Billing["账单确认"]
  Ops["运营后台"] --> Inquiry
  Ops --> Inbound
  Ops --> Outbound
  Ops --> Return
  Ops --> Billing
  Warehouse["仓库作业台"] --> Receiving["收货 / 上架"]
  Warehouse --> Picking["拣货 / 打包 / 交运"]
  Receiving --> Inventory["库存余额 / 库存流水"]
  Picking --> Inventory
```

## Application Surfaces

- Marketing surface: `/`, `/services`, `/pricing`, `/inquiry`, `/help`
- Customer surface: `/login`, `/portal`, `/account`, `/inbound`, `/skus`, `/outbound`, `/returns`, `/billing`, `/tracking`
- Ops surface: `/ops-login`, `/ops`
- Warehouse surface: `/warehouse`, `/warehouse/print/*`
- API surface: `/api/*`

## Domain Modules

- `src/lib/customerAuth.ts` and `src/lib/staffAuth.ts`: customer and staff session helpers
- `src/lib/customerAccountStore.ts`: customer account and profile data
- `src/lib/warehouseCoreStore.ts`: SKU, inventory, outbound, returns, billing, carrier and warehouse operations
- `src/lib/documentStore.ts`: customer and ops document metadata
- `src/lib/notificationStore.ts`: customer and staff todo states
- `src/lib/auditLogStore.ts`: audit trail helpers
- `src/lib/db.ts`: PostgreSQL connection helper

## Persistence Strategy

The project currently supports two modes:

- Local fallback stores under `.local-data` for demos and lightweight development.
- PostgreSQL schema under `db/schema.sql` for production-oriented storage.

The roadmap is to keep the local fallback useful for onboarding while moving more core workflows to PostgreSQL-backed repositories.

## Security Boundaries

- Customer-facing pages and APIs should always scope data by `customer_code`.
- Staff-only APIs should require staff session validation.
- Production deployments must configure `SESSION_SECRET` and `STAFF_WHITELIST_JSON`.
- Demo login switches must stay disabled in production.
- Uploaded files need object storage, access control, and malware scanning before production use.
