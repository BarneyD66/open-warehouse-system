# 自营仓储系统一期 PRD

## 1. 产品定位

本项目不是单纯的英国海外仓官网，也不是一次性做完整 ERP/WMS。第一阶段定位为：

**官网获客 + 客户自助门户 + 内部运营后台 + 仓储核心数据底座**。

对外表达：

> 面向中国跨境卖家的英国本地仓配服务商，提供仓储、一件代发、退货换标、FBA 中转，并通过自营仓储系统让货件、资料、异常和费用可查。

对内目标：

- 客户提交的需求能沉淀为真实线索。
- 客户创建的入库预报能进入正式 ASN 流程。
- 客户、SKU、ASN、附件、状态、费用都有结构化记录。
- 客户只能看到自己的业务数据。
- 运营后台能处理报价、资料审核、入库状态和异常跟进。

## 2. 一期目标

一期不追求完整自动化，先做到“能真实接客户、能真实跟单、能解释费用”。

### 2.1 业务目标

- 官网可以承接真实客户询盘。
- 客服可以在后台跟进询盘、生成报价草案、推进客户入仓。
- 客户可以创建入库预报、补交资料、查询状态。
- 系统可以记录每个业务节点的状态变化。
- 后续可平滑扩展 SKU、库存、订单、退货、FBA 和账单。

### 2.2 体验目标

- 客户 10 秒内知道我们是“英国仓配 + 自营系统 + 中文客服”。
- 客户不需要先理解复杂 WMS，也能完成询盘和入库预报。
- 客服能看到客户平台、货量、SKU、尾程、FBA、退货等报价关键字段。
- 客户查进度时看到清晰下一步，而不是只看到一条提交记录。

## 3. 用户角色

| 角色 | 核心诉求 | 一期权限 |
| --- | --- | --- |
| 新客户 | 确认能不能做、费用怎么收、怎么入仓 | 提交询盘、费用预估、查进度 |
| 已合作客户 | 创建入库、补资料、查状态、看账单 | 登录门户、查看自己的业务单据 |
| 客服/销售 | 跟进询盘、确认报价、引导入仓 | 查看线索、更新状态、记录报价草案 |
| 仓库运营 | 审核资料、确认到仓、登记异常 | 查看 ASN、更新入库状态、记录异常 |
| 财务 | 解释费用、生成账单 | 查看费用来源、维护账单草案 |
| 管理员 | 配置账号、客户和基础数据 | 用户、角色、客户隔离、审计 |

## 4. 一期范围

### P0：必须完成

1. 数据库替换本地 JSON
   - 将 `.local-data/submissions.json` 替换为 PostgreSQL。
   - 保留现有接口能力，但数据写入正式表。

2. 客户与账号隔离
   - 新增客户主体、客户用户、内部用户。
   - 客户登录后只能查看自己的询盘、ASN、附件、状态和账单。

3. 询盘线索结构化
   - 当前表单字段升级为可报价线索。
   - 必须记录：平台、月单量、服务需求、尾程需求、FBA 需求、退货需求、品类、SKU 数、尺寸重量、首批入仓计划、来源入口。

4. 报价跟进
   - 后台可更新询盘状态。
   - 后台可录入报价草案：入库、仓储、出库、退货、FBA、增值服务、备注、有效期。
   - 客户查进度时能看到“已收到 / 已联系 / 已报价 / 待客户确认 / 转入库”。

5. 正式 ASN 入库预报
   - 入库预报从单条表单升级为 ASN 主单。
   - 支持基础字段、附件、SKU 明细行、状态时间线。

6. 附件与资料补交
   - 支持装箱单、外箱标签、FBA 标签、产品图片、追踪号、备注。
   - 资料补交后记录到对应询盘或 ASN。

7. 状态时间线
   - 询盘和 ASN 都必须有 `StatusEvent`。
   - 客户看到客户可读文案，内部看到操作备注和责任人。

8. 运营后台一期
   - 询盘队列。
   - 报价跟进。
   - 入库预报队列。
   - 缺资料/缺追踪号提醒。
   - 状态更新和备注。

### P1：一期后增强

- SKU 商品档案。
- ASN 明细行批量导入。
- 入库资料审核结果。
- 到仓、收货、差异、上架状态。
- 客户门户账单草案。
- 邮件/站内通知。
- 状态时间线视觉增强。

### P2：正式 WMS 扩展

- 库存余额和库存流水。
- 订单履约。
- 拣货、打包、出库。
- 退货质检、换标、销毁。
- FBA 中转任务。
- 自动计费和账单。
- 物流渠道和平台 API。

## 5. 核心流程

### 5.1 询盘到报价

1. 客户从首页、费用页、服务页或 AI 预判断进入询盘页。
2. 客户填写公司、联系人、平台、月单量、服务需求、尾程需求、FBA/退货需求。
3. 系统创建 `InquiryLead`，状态为 `new`。
4. 客服后台看到新线索。
5. 客服联系客户，状态变为 `contacted`。
6. 客服录入报价草案，状态变为 `quoted`。
7. 客户确认后，客服将线索转为客户和 ASN。

询盘状态：

```text
new -> contacted -> quoted -> waiting_customer -> converted_to_inbound -> closed
```

### 5.2 入库预报到资料审核

1. 客户登录或从询盘成功页进入入库预报。
2. 客户填写预计到仓、运输方式、承运商/追踪号、箱数/托数、SKU 数、主要品名、服务要求。
3. 客户上传装箱单、标签、FBA 文件或产品图片。
4. 系统创建 `InboundASN`，状态为 `submitted`。
5. 运营后台审核资料。
6. 资料完整则状态进入 `docs_review_passed` 或 `appointment_confirmed`。
7. 缺资料则生成待办，客户在门户补交。

ASN 一期状态：

```text
draft -> submitted -> docs_review -> appointment_confirmed -> arrived -> receiving -> received -> putaway_completed -> closed
```

异常状态：

```text
on_hold / exception / cancelled
```

### 5.3 客户查进度

1. 客户输入询盘编号、ASN 编号、手机号、微信号或追踪号。
2. 系统按客户可见范围返回相关记录。
3. 每条记录展示：
   - 当前状态
   - 下一步
   - 最近更新时间
   - 需要客户补充的资料
   - 客服备注

## 6. 页面需求

### 6.1 官网首页

目的：建立信任和转化。

必须突出：

- 英国本地仓配能力。
- 自营仓储系统。
- 中文客服协同。
- 支持仓储、一件代发、退货换标、FBA 中转。
- 客户可提交需求、创建入库预报、查进度、补资料、核费用。

主 CTA：

- 获取英国仓报价。
- 创建入库预报。
- 查看费用说明。
- AI 预判断。

### 6.2 费用页

目的：解释费用结构，不公开完整报价表。

必须包含：

- 一件代发费用组成。
- FBA 中转费用组成。
- 退货换标费用组成。
- 影响报价因素。
- 费用不包含项。
- 获取准确报价入口。

不得承诺：

- 固定低价。
- 全部尾程渠道固定可用。
- 未经确认的时效。

### 6.3 询盘页

目的：收集报价所需字段。

必填：

- 公司/店铺名称。
- 联系人。
- 手机/微信或邮箱。
- 销售平台。
- 预计月单量。
- 主要服务需求。

重要选填：

- 英国尾程派送需求。
- 产品品类。
- SKU 数量。
- 平均尺寸/重量。
- 首次入仓计划。
- FBA 需求。
- 退货需求。
- 可能同时需要的服务。

### 6.4 入库预报页

目的：创建正式 ASN。

一期字段：

- 客户/店铺名称。
- 联系人。
- 手机/微信。
- 平台。
- 预计到仓日期。
- 运输方式。
- 承运商/追踪号/车牌/柜号。
- 箱数/托数。
- SKU 数量。
- 主要品名/SKU。
- 服务要求。
- 特殊属性。
- 附件。

### 6.5 客户门户

目的：证明自营系统能力。

一期展示：

- 询盘状态。
- 入库预报状态。
- 待补资料。
- 最近状态时间线。
- 费用/报价草案摘要。
- 常用操作入口。

### 6.6 运营后台

目的：客服和运营承接业务。

一期能力：

- 询盘队列。
- 入库预报队列。
- 缺资料队列。
- 报价草案录入。
- 状态更新。
- 客服备注。
- 下一次跟进时间。

## 7. 数据模型一期

### CustomerAccount

- id
- customer_code
- company_name
- contact_name
- phone
- email
- status: draft / active / suspended / closed
- created_at
- updated_at

### CustomerUser

- id
- customer_id
- name
- phone
- email
- role: owner / ops / finance
- password_hash
- status
- created_at

### InternalUser

- id
- name
- email
- role: admin / sales / ops / finance
- status

### InquiryLead

- id
- customer_id nullable
- company
- contact
- phone
- email
- platform
- monthly_volume
- service
- lead_intent
- lead_source
- origin
- tail_delivery_need
- product_category
- sku_count_estimate
- average_size_weight
- first_inbound_plan
- fba_need
- return_need
- service_needs
- note
- status
- assigned_to
- created_at
- updated_at

### QuoteDraft

- id
- inquiry_id
- currency
- inbound_fee
- storage_fee
- outbound_fee
- return_fee
- fba_fee
- value_added_fee
- monthly_fee
- notes
- valid_until
- created_by
- created_at
- updated_at

### InboundASN

- id
- customer_id
- warehouse_id
- asn_no
- platform
- eta
- transport
- carrier_name
- tracking_no
- container_no
- carton_count
- pallet_count
- sku_count
- product_name
- service
- attribute
- status
- created_by
- created_at
- updated_at

### InboundASNLine

- id
- asn_id
- sku_code
- product_name
- expected_qty
- carton_count
- pallet_count
- received_qty
- damaged_qty
- short_qty
- over_qty

### Attachment

- id
- owner_type: inquiry / asn / customer / sku / return / invoice
- owner_id
- file_name
- file_url
- file_type
- uploaded_by
- created_at

### StatusEvent

- id
- ref_type: inquiry / asn / quote / invoice
- ref_id
- from_status
- to_status
- message_customer
- message_internal
- operator_id
- occurred_at

### AuditLog

- id
- actor_id
- actor_type
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at

## 8. API 一期

### Auth

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Inquiries

- `POST /api/inquiries`
- `GET /api/inquiries`
- `GET /api/inquiries/:id`
- `PATCH /api/inquiries/:id/status`
- `POST /api/inquiries/:id/quote`
- `POST /api/inquiries/:id/convert-to-customer`

### Inbounds

- `POST /api/inbounds`
- `GET /api/inbounds`
- `GET /api/inbounds/:id`
- `PATCH /api/inbounds/:id/status`
- `POST /api/inbounds/:id/attachments`
- `POST /api/inbounds/:id/review-docs`

### Tracking

- `GET /api/tracking?q=`

### Files

- `POST /api/files`
- `GET /api/files/:id`

## 9. 权限与安全

一期必须满足：

- 所有客户数据必须带 `customer_id`。
- 客户 API 必须按 `customer_id` 过滤。
- 内部后台按角色控制可见范围。
- 附件下载需要权限校验。
- 关键操作写 `AuditLog`。
- 提交类 API 预留 `idempotency_key`。

## 10. 验收标准

### 官网与询盘

- 客户能从首页进入询盘。
- 客户能提交包含尾程、FBA、退货等字段的询盘。
- 后台能看到该询盘。
- 客服能更新状态和报价草案。
- 客户能用编号查询当前状态。

### 入库预报

- 客户能创建入库预报。
- 客户能上传或补交资料。
- 后台能看到缺资料状态。
- 后台能更新 ASN 状态。
- 客户查进度能看到下一步。

### 客户隔离

- 客户 A 登录后不能看到客户 B 数据。
- 内部用户能按权限查看所有或部分客户数据。
- 所有状态变更有操作记录。

### 工程质量

- `npm run lint` 通过。
- `npm run build` 通过。
- 核心表单移动端可用。
- 关键页面无明显 console error。

## 11. 里程碑

### M1：真实数据底座

- PostgreSQL 接入。
- Customer / User / Inquiry / Quote / ASN / Attachment / StatusEvent / AuditLog 表。
- 现有询盘和入库接口迁移。

### M2：客户门户可用

- 客户登录。
- 客户数据隔离。
- 询盘、ASN、资料、状态展示。
- 查进度基于 StatusEvent。

### M3：运营后台可用

- 询盘队列。
- 报价草案。
- 入库预报队列。
- 缺资料处理。
- 状态更新时间线。

### M4：仓储核心扩展准备

- SKU 草案。
- ASN 明细行。
- 收货/上架状态预留。
- 库存流水模型设计完成。

## 12. 暂不做

一期暂不做：

- 完整库存流水。
- 订单履约自动化。
- PDA 扫码。
- 平台 API 对接。
- 自动购买面单。
- 多仓调拨。
- 复杂财务系统。
- 客户钱包。

这些功能在 ASN 和客户数据底座稳定后再进入 P2。

