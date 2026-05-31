# MVP 数据模型与后端边界

## 架构原则

MVP 可以先采用一个 PostgreSQL 单体库，按业务 schema 模块化：

- auth
- customer
- compliance
- catalog
- warehouse
- inventory
- inbound
- fulfillment
- returns
- fba
- billing
- ticket
- audit

三条底线：

1. 库存可追溯：任何库存数量变化都能从 InventoryLedger 还原。
2. 合规可审计：VAT/EORI/FHDDS 资料、文件、审核动作有留痕和保留期。
3. 费用可解释：每一笔账单行都能回溯到 ASN、订单、退货、FBA 或仓储日结事件。

## 核心实体

### CustomerAccount

- id
- tenant_id
- customer_code
- company_name_cn
- company_name_en
- country
- contact_name
- email
- phone
- billing_address
- registered_address
- status: draft / pending_kyc / active / suspended / closed
- risk_level: low / medium / high
- created_at

### CustomerComplianceProfile

- id
- customer_id
- vat_number
- vat_country
- eori_number
- company_registration_no
- uk_tax_agent_name
- marketplace_accounts
- business_type
- kyc_status
- fhdds_due_diligence_status
- last_reviewed_at
- next_review_due_at
- retention_until
- notes

### ComplianceDocument

- id
- customer_id
- document_type: business_license / vat_certificate / eori_proof / id / address_proof / import_entry / authorization / marketplace_screenshot / other
- file_url
- file_hash
- issued_at
- expires_at
- verified_status
- verified_by
- verified_at

### Sku

- id
- customer_id
- product_id
- sku_code
- fnsku
- asin
- barcode
- hs_code
- declared_name_en
- declared_name_cn
- declared_value
- currency
- length_cm
- width_cm
- height_cm
- weight_g
- battery_type
- dangerous_goods_flag
- fragile_flag
- expiry_control_flag
- lot_control_flag
- serial_control_flag
- status

### Warehouse / Location

Warehouse:

- id
- tenant_id
- warehouse_code
- name
- address
- country
- timezone
- status

Location:

- id
- warehouse_id
- location_code
- zone: receiving / storage / picking / returns / fba / exception
- location_type: bin / pallet / shelf / staging
- status

### InventoryBalance

- id
- customer_id
- warehouse_id
- sku_id
- location_id
- lot_no
- condition: sellable / damaged / returned / quarantine / expired
- on_hand_qty
- available_qty
- reserved_qty
- inbound_qty
- outbound_qty
- updated_at

### InventoryLedger

- id
- customer_id
- warehouse_id
- sku_id
- location_id
- lot_no
- condition
- movement_type
- ref_type
- ref_id
- qty_delta
- balance_after
- unit_cost
- occurred_at
- operator_id
- idempotency_key

库存流水类型：

- asn_expected
- receiving_putaway
- order_reserve
- order_unreserve
- pick
- ship_confirm
- return_receive
- relabel_in
- relabel_out
- fba_transfer_out
- adjustment_plus
- adjustment_minus
- damage
- quarantine
- dispose
- cycle_count

## 入库模型

### InboundASN

- id
- customer_id
- warehouse_id
- asn_no
- source_country
- transport_mode: sea / air / rail / truck / courier
- carrier_name
- tracking_no
- container_no
- eta
- incoterm
- import_entry_no
- customs_declaration_ref
- status
- created_by
- created_at

### InboundASNLine

- id
- asn_id
- sku_id
- expected_qty
- received_qty
- damaged_qty
- short_qty
- over_qty
- lot_no
- expiry_date
- carton_count
- pallet_count

ASN 状态机：

draft -> submitted -> appointment_confirmed -> arrived -> receiving -> partially_received -> received -> putaway_completed -> closed

异常分支：

- submitted / arrived / receiving -> on_hold
- on_hold -> receiving / closed / cancelled
- draft / submitted -> cancelled

## 订单履约模型

### SalesOrder

- id
- customer_id
- warehouse_id
- order_no
- external_order_no
- platform: amazon / ebay / shopify / tiktok / temu / manual / api
- ship_to_name
- ship_to_phone
- ship_to_email
- ship_to_address
- ship_to_country
- service_level
- status
- payment_status
- created_at

### FulfillmentTask

- id
- order_id
- task_no
- wave_no
- status: pending / allocated / picking / packed / shipped / cancelled / exception
- assigned_to

### Shipment

- id
- order_id
- carrier
- service_code
- tracking_no
- label_url
- shipping_cost
- currency
- status

订单状态机：

created -> inventory_check -> allocated -> picking -> packed -> label_created -> shipped -> delivered -> closed

异常分支：

- created / inventory_check -> out_of_stock
- allocated / picking / packed -> exception
- shipped -> returned

## 退货与 FBA

### ReturnOrder

- id
- customer_id
- warehouse_id
- rma_no
- original_order_id
- return_tracking_no
- return_reason
- status
- created_at

退货状态机：

created -> in_transit -> received -> inspected -> disposition_pending -> completed

### RelabelTask

- id
- customer_id
- warehouse_id
- task_no
- source_sku_id
- target_sku_id
- qty
- label_type
- status
- fee_status

### FbaTransfer

- id
- customer_id
- warehouse_id
- transfer_no
- amazon_shipment_id
- destination_fba_code
- destination_address
- status
- created_at

FBA 状态机：

draft -> submitted -> inventory_allocated -> prep_in_progress -> packed -> booked -> shipped -> closed

## 计费模型

MVP 采用“费率卡 + 作业事件 + 月结账单”。

### BillingRateCard

- id
- plan_id
- charge_code
- charge_name
- billing_basis
- unit_price
- min_charge
- currency
- tax_rate
- status

常用 charge_code：

- INBOUND_RECEIVING_PER_CARTON
- STORAGE_PER_CBM_DAY
- PICK_PACK_FIRST_ITEM
- PICK_PACK_ADDITIONAL_ITEM
- LABEL_PRINT
- RELABEL_PER_UNIT
- RETURN_RECEIVING
- RETURN_INSPECTION
- FBA_PREP_PER_UNIT
- OUTBOUND_SHIPPING_PASS_THROUGH
- DISPOSAL_PER_UNIT
- PHOTO_EVIDENCE

### ChargeEvent

- id
- customer_id
- source_type: asn / order / return / relabel / fba / storage / manual
- source_id
- charge_code
- qty
- unit_price
- amount
- currency
- tax_amount
- occurred_at
- billing_status
- invoice_id

### Invoice

- id
- customer_id
- invoice_no
- billing_period_start
- billing_period_end
- subtotal
- tax_total
- total
- currency
- status: draft / issued / partially_paid / paid / overdue / void
- issued_at
- due_at

## API 模块边界

| 服务 | 职责 |
| --- | --- |
| Customer & Compliance | 客户档案、VAT/EORI/FHDDS、文件、审核、审计 |
| Catalog | SKU、FNSKU、HS Code、尺寸重量、标签模板 |
| Inventory | 库存余额、库存流水、冻结、释放、调整、盘点 |
| Inbound | ASN、预约、收货、异常、上架 |
| Fulfillment | 订单、分配、拣货、打包、面单、出库 |
| Returns & Relabel | RMA、退货接收、质检、换标、销毁、重上架 |
| FBA Transfer | FBA 补仓、贴标、换箱、打托、发运 |
| Billing | 费率卡、计费事件、账单、收款、调整 |
| Ticket | 工单、消息、附件、SLA |

关键约束：

- 所有业务单据必须带 customer_id。
- 所有库存变动必须写 InventoryLedger。
- 所有计费必须来自 ChargeEvent，人工费用也作为事件。
- 合规字段变更必须写 ComplianceAuditLog。
- 重要 API 必须支持 idempotency_key。
