# 仓储物流工作台 MVP 当前状态

## 已完成闭环

- 客户自注册、客户登录、运营登录和登出已分流：客户可在 `/login` 或 `/workspace` 直接注册并自动生成客户编号，进入 `/portal` 后可退出回 `/login`。
- 客户账号体系已补齐 MVP：支持手机号/邮箱唯一性校验、客户资料页、公司资料/VAT/EORI/平台店铺维护、修改密码、忘记密码重置和账号状态展示。
- 运营后台采用员工白名单登录：白名单员工进入 `/ops-login` 后再进入 `/ops` 并可退出回 `/ops-login`，未登录员工不能访问 `/ops` 或调用 `/api/ops/[kind]/[id]`。
- 客户提交报价需求：`/inquiry` -> `/api/inquiries` -> 客户工作台 `/portal` -> 运营后台 `/ops`。
- 客户创建入库预报：`/inbound` -> `/api/inbounds` -> 客户工作台 `/portal` -> 运营后台 `/ops`。
- 客户补交资料：`/supplement` -> `/api/supplements` -> 入库预报资料和追踪号更新。
- 运营推进入库状态：`/ops` 入库卡片 -> `/api/inbounds/[id]` -> 客户侧进度同步。
- 运营推进物流、库存、出库状态：`/ops` 表格状态控件 -> `/api/ops/[kind]/[id]` -> 客户侧 `/portal`、`/tracking`、`/billing` 展示。
- 正式数据底座已补强：客户、SKU、库存余额、库存流水、出库订单、账单记录已进入 `db/schema.sql` 和本地 fallback store。
- 账单确认与复核闭环已打通：客户在 `/billing` 确认账单、提出异议、提交付款参考号；运营在 `/ops` 账单复核表中确认付款或处理异议。
- 文件资料闭环已打通：客户可在账单中上传付款凭证/资料，运营可在 `/ops` 资料中心查看并下载。
- SKU 与出库申请闭环已打通：客户可创建 SKU 档案并初始化库存底表，可提交出库申请；运营可在 `/ops` 查看客户出库申请。
- 库存调整审批与出库推进闭环已打通：仓库/运营可提交库存调整申请，管理员或运营审批通过后才写入库存余额和库存流水，并可推进客户出库申请到拣货、面单、包装、交运、已发货等状态。
- 客户与运营待办中心已接入：系统会根据询盘、入库资料、物流异常、账单、库存预警、出库和付款凭证生成待办，客户/运营可分别关闭已处理待办。
- 仓库作业台已形成 MVP：仓库员工可进入 `/warehouse` 处理入库到仓、收货验收、上架、出库拣货、打包复核、交运和异常阻塞。
- 入库上架与正式库存已打通：仓库把入库任务推进到“已上架”时，系统会按入库 SKU 明细写入正式 SKU、库存余额和库存流水，并避免同一 ASN 重复入账。
- 条码/库位/打印 MVP 已接入仓库作业：仓库可按 ASN、出库单、SKU、追踪号和库位扫码检索，可维护库位、CSV 导入导出库位和库存，并生成拣货单与临时面单打印页。
- SKU 批量导入导出与出库批量处理已接入：客户可下载 SKU 模板、CSV 导入/导出 SKU 档案；运营可批量选择出库单推进状态，并生成批量拣货单打印页。
- 物流面单与追踪回传 MVP 已接入：运营可按承运商服务试算运费、生成面单追踪号、打印面单，并回传交运、运输、派送、签收或异常节点，客户侧可在出库和追踪页查看最新物流状态。
- 退货 / RMA MVP 已接入：客户可提交退货预报、SKU、买家追踪号和处理偏好；运营可推进待审核、退货在途、到仓、质检、重新上架、维修、报废和异常状态；重新上架会写入库存流水。
- 生产共享数据库已接入 Neon Postgres：`sheffield-warehouse-app`、`sheffield-warehouse-admin`、`sheffield-warehouse-web` 生产环境已配置同一组 `POSTGRES_URL` / `DATABASE_URL`，仓储核心数据不再依赖各项目独立 `/tmp`。

## 当前 MVP 页面

- `/portal`：客户工作台，展示待办、入库、出库、物流、正式库存、报价。
- `/account`：客户账号与公司资料页，支持维护公司资料、VAT、EORI、平台店铺、公司地址和修改密码。
- `/tracking`：业务进度总览，展示报价、入库、出库物流、库存状态。
- `/billing`：费用账单 MVP，展示账单状态、金额、到期日、关联业务、报价方案、客户动作和付款凭证。
- `/inquiry`：客户提交报价需求。
- `/inbound`：客户创建 ASN 入库预报。
- `/supplement`：客户补交追踪号、资料类型和备注。
- `/skus`：客户 SKU 档案页，支持新增 SKU、维护商品名称/条码/分类/预警库存、CSV 批量导入导出，并查看库存底表。
- `/outbound`：客户出库申请页，支持按 SKU 和数量提交尾程履约需求。
- `/returns`：客户退货 / RMA 预报页，支持提交平台订单、买家退货追踪号、SKU、退货原因和处理偏好。
- `/ops`：内部运营后台，处理询盘、入库、物流、库存、出库队列、账单复核、资料中心和客户出库申请。
- `/ops` 正式库存区：支持库存调整/盘点申请、库存调整审批、查看正式库存底表和最近库存流水。
- `/warehouse`：仓库员工实操作业台，处理入库收货上架和出库拣货交运；仓库白名单账号登录后默认进入该页面。
- `/warehouse/print/pick-list/[id]`：出库拣货单打印页。
- `/warehouse/print/pick-list/batch`：批量出库拣货单打印页，支持按多个出库单汇总 SKU、库位和数量。
- `/warehouse/print/label/[id]`：面单打印页，当前可展示承运商服务、追踪号、包裹重量、件数和预估运费；后续可替换为真实承运商 PDF/ZPL。
- `/login`、`/workspace`：客户自注册和登录入口，不需要开通码或客户编号，注册后系统自动生成客户编号。
- `/ops-login`：内部员工白名单登录页，本地 demo 白名单账号包括 `ops / Ops@2026Test`、`warehouse / Warehouse@2026Test`、`admin / Admin@2026Test`，正式环境可通过 `STAFF_WHITELIST_JSON` 配置真实员工账号。

## 当前 MVP API

- `/api/billing/[id]`：客户账单动作接口，支持确认、异议、提交付款参考号。
- `/api/ops/billing/[id]`：运营账单复核接口，支持推进待确认、已确认、付款待复核、已付款、费用异议状态。
- `/api/documents`：客户文件上传和列表接口，当前用于付款凭证、账单资料等文件。
- `/api/documents/[id]/download`：文件下载接口，客户只能下载自己的文件，运营可下载全部客户文件。
- `/api/skus`：客户 SKU 查询、建档、CSV 模板下载、CSV 导出和批量导入接口。
- `/api/outbounds`：客户出库申请查询和创建接口。
- `/api/register`：客户自注册接口，生成客户编号、创建客户档案并直接建立客户登录态。
- `/api/register/check`：注册前检查手机号和邮箱是否已被占用。
- `/api/account`：客户资料读取和保存接口。
- `/api/account/password`：登录后修改密码接口。
- `/api/account/reset-password`：忘记密码重置接口，MVP 阶段先不接短信/邮箱验证码。
- `/api/ops/outbounds/[id]`：运营推进客户出库申请状态接口。
- `/api/ops/outbounds/batch`：运营批量推进客户出库申请状态接口。
- `/api/ops/shipping/rates`：运营读取承运商服务与运费规则接口。
- `/api/ops/outbounds/[id]/shipping`：运营试算运费和生成面单追踪号接口。
- `/api/ops/outbounds/[id]/tracking`：运营回传出库物流追踪节点接口。
- `/api/ops/inventory-adjustments`：运营库存调整/盘点申请和审批接口，审批通过后写入库存余额和库存流水。
- `/api/returns`：客户退货预报查询和创建接口。
- `/api/ops/returns/[id]`：运营退货 / RMA 状态推进接口，重新上架时写入库存流水。
- `/api/notifications`：客户与运营待办关闭接口，按登录身份限制客户待办和员工待办。
- `/api/warehouse/tasks/[type]/[id]`：仓库作业接口，支持入库任务状态推进、入库上架写库存、出库任务推进和出库发货扣减预占库存。
- `/api/warehouse/locations`：库位查询、新增/更新和 CSV 批量导入接口。
- `/api/warehouse/exports/[kind]`：仓库 CSV 导出接口，当前支持 `locations` 和 `inventory`。

## 本轮新增

- 新增 `/warehouse` 仓库作业台，将马帮式海外仓核心作业拆为入库收货上架和出库拣货打包交运两个队列。
- 新增 `WarehouseTaskAction`，仓库员工可直接在任务表中选择下一状态、填写库位和作业备注。
- 新增 `putawayInboundInventory`，入库上架时把 ASN SKU 明细同步为正式 SKU、库存余额和入库流水。
- 新增扫码检索面板，支持按 ASN、出库单、SKU、追踪号和库位快速定位仓库任务与库存记录。
- 新增库位管理面板，支持单个库位新增/更新、CSV 批量导入和库位 CSV 导出。
- 新增库存 CSV 导出、拣货单打印页和临时面单打印页，并提供页面内打印按钮。
- 新增客户 SKU 批量导入导出：`/skus` 支持下载导入模板、导出当前 SKU/库存 CSV，并可上传 CSV 批量新增或更新 SKU 档案。
- 新增运营出库批量处理：`/ops` 支持勾选多张出库单，批量推进到拣货、面单、包装、交运、已发货或异常阻塞状态。
- 新增批量拣货单打印：`/warehouse/print/pick-list/batch` 可汇总多张出库单的 SKU、库位、数量和客户信息，便于仓库集中拣货。
- 新增物流面单 MVP：`warehouseCoreStore` 增加承运商规则、运费试算、面单生成、追踪号和追踪事件；运营后台可生成面单并回传追踪节点。
- `/tracking` 重写为干净 UTF-8 页面，并接入正式出库物流数据，客户可看到承运商、追踪号、预估运费和最新节点。
- `db/schema.sql` 新增 `warehouse_locations`，为后续正式库位管理预留结构。
- `/api/staff-login` 会按员工角色返回默认入口，`warehouse / Warehouse@2026Test` 本地 demo 登录后进入 `/warehouse`。
- `/ops` 顶部新增“仓库作业台”入口，运营可快速切到仓库视角核对作业。
- `/ops` 新增“客户认证审核”工作区：运营可查看自注册客户的公司、联系人、VAT、EORI、平台店铺资料，并将账号切换为未认证、已认证或暂停。
- 新增 `auditLogStore` 与 `.local-data/audit-logs.json` 本地留痕，客户注册、客户资料更新和运营审核状态变更都会写入操作记录。
- 新增 `/api/ops/customers/[customerCode]`，员工白名单登录后可更新客户账号状态，接口会同步 `customerAccountStore` 与 `warehouseCoreStore`。
- `db/schema.sql` 新增 `warehouse_audit_logs`，为正式数据库化后的账号审核和重要操作追溯预留结构。
- 新增 `/skus` 和 `/outbound` 两个客户生产作业入口。
- `warehouseCoreStore` 新增 SKU 建档和客户出库申请创建能力，出库提交后会写入库存预占流水。
- `/portal` 新增 SKU 档案、出库申请快捷入口，并展示客户正式出库申请。
- `/ops` 新增客户出库申请表，运营可查看 SKU 明细、期望发货日、地址和备注。
- `/ops` 客户出库申请表新增状态推进控件，可推进待审核、拣货中、待面单、包装复核、待交运、已发货、异常阻塞。
- `/ops` 库存调整/盘点升级为审批模式，支持按客户 SKU 提交可用/占用库存、预警值、库龄和原因，审批通过后才落库存流水。
- `/ops` 新增正式库存底表和最近库存流水，库存调整与出库发货都会写入流水。
- `db/schema.sql` 的出库订单表补充收件人、地址、期望发货日和备注字段。
- `db/schema.sql` 新增库存流水 ref 索引，便于按出库/调整追溯库存变化。
- `/portal` 新增客户待办中心，聚合报价确认、入库补资料、追踪号补充、账单确认/付款/异议、库存预警、出库异常和物流异常。
- `/ops` 新增运营待办中心，聚合新询盘、入库异常、物流异常、账单复核、客户出库推进、低库存和付款凭证。
- 新增 `notificationStore` 和 `.local-data/notifications.json` 本地状态，支持已处理待办关闭后从列表隐藏。
- `db/schema.sql` 新增 `warehouse_notification_states`，为后续数据库化消息状态预留结构。
- `/login` 和 `/workspace` 改为客户自注册/登录模式，客户侧彻底取消开通码、邀请码和老客户编号绑定。
- 新增 `customerAccountStore` 和 `/api/register`，注册后自动写入客户账号、客户档案和 session。
- `customerAccountStore` 新增资料维护、手机号/邮箱去重、修改密码和重置密码能力。
- `/portal` 新增“账号资料”入口，指向 `/account`。
- 员工登录改为白名单语义，支持后续通过环境变量维护运营、仓库、财务和管理员账号。
- `db/schema.sql` 新增 `warehouse_customer_accounts`，并为客户表补充 VAT、EORI、平台、店铺链接、公司地址和账号状态字段。
- 新增 `/returns` 退货预报页、`/api/returns`、`/api/ops/returns/[id]` 和运营后台 RMA 处理表。
- `warehouseCoreStore` 新增 `ReturnOrder`、RMA 状态流转、质检结果、处理结果和退货重新上架库存流水。
- `db/schema.sql` 新增 `warehouse_return_orders`，为退货预报、平台订单号、买家退货追踪号和状态查询预留结构。

## 验证记录

- `npm run lint` 通过。
- `npm run build` 通过。
- Playwright 已验证仓库作业台闭环：客户创建带 SKU 明细的入库预报，仓库推进到已上架后写入正式库存；客户提交出库申请后，仓库推进到已发货，接口返回 200。
- Playwright 已验证 `/warehouse` 桌面端和 390px 移动端无横向溢出，仓库白名单账号登录后默认进入 `/warehouse`。
- Playwright 已验证库位管理与打印闭环：新增库位、CSV 导入库位、导出库位 CSV、扫码检索 SKU、入库上架写入库位、拣货单和临时面单打印页均可访问。
- Playwright 已验证 SKU 批量导入导出与运营批量出库闭环：CSV 导入新增 SKU、CSV 导出包含新增 SKU、客户 `/skus` 展示批量工具；运营 `/ops` 批量推进 2 张出库单，并访问批量拣货单打印页。
- Playwright 已验证物流面单闭环：运营读取承运商规则、试算 DPD 运费、生成面单追踪号、回传交运节点，客户 `/tracking` 与面单打印页均可看到同一追踪号。
- 已验证生产共享数据库：Neon schema 初始化完成，生产库已有客户、SKU、库存和出库种子数据；写入出库追踪号 `CFG24536980` 后，客户工作台 `/tracking` 可读取同一追踪节点。
- Playwright 已验证账单闭环：客户确认账单、提交付款参考号、运营复核为已付款，接口返回 200，桌面和移动端无横向溢出。
- Playwright 已验证文件闭环：客户上传付款凭证、客户下载、运营资料中心展示，运营侧页面移动端和桌面端无横向溢出。
- Playwright 已验证 SKU/出库闭环：客户创建 SKU、提交出库申请，客户 `/skus`、`/outbound`、`/portal` 与运营 `/ops` 均可看到同一业务记录，桌面和移动端无横向溢出。
- Playwright 已验证库存调整/出库推进闭环：运营调整库存、客户提交出库、运营推进到已发货，客户 `/outbound`、`/portal` 与运营 `/ops` 均可看到同一记录，桌面和移动端无横向溢出。
- 已验证库存调整审批页面：`npm run lint`、`npm run build` 通过；本地 admin 环境 `/ops` 可渲染“库存调整审批”和“提交审批”区域。
- 已验证退货 / RMA 页面：`npm run lint`、`npm run build` 通过；本地客户 `/returns` 可渲染“创建退货预报”“我的退货预报”，本地运营 `/ops` 可渲染“退货 / RMA 处理”。
- Playwright 已验证待办中心闭环：客户和运营都能看到低库存待办，点击关闭后刷新不再出现同一待办，`/portal` 与 `/ops` 桌面和 390px 移动端均无横向溢出。
- Playwright 已验证登出闭环：客户和运营工作台均展示退出登录按钮，退出后清除对应 cookie，并重新访问受保护页面时回到各自登录页。
- Playwright 已验证客户自注册闭环：注册、自动生成客户编号、进入工作台、退出、再登录仍回到同一客户账号。
- Playwright 已验证客户账号体系闭环：重复手机号/邮箱检查、客户资料保存、VAT/EORI/平台字段保存、修改密码后旧密码失效、新密码登录、忘记密码重置后可登录。
- Playwright 已验证 `/account` 桌面端和 390px 移动端无横向溢出。
- Playwright 已验证员工白名单：非白名单账号调用 `/api/staff-login` 返回 401。
- 已完成真实提交 smoke test：询盘、入库预报、补资料、运营物流状态更新。
- 已完成权限 smoke test：匿名访问 `/ops` 跳转 `/ops-login`，员工登录后可访问 `/ops`，未登录调用运营状态 API 返回 401。

## MVP 尚未包含

- 正式权限角色和账号管理：客户已具备 MVP 自注册，员工仍需接入正式白名单/角色后台和密码管理。
- 对象存储/S3/Blob、病毒扫描、文件预览、发票和对账单导出。
- 真实物流承运商 API 对接、承运商 PDF/ZPL 面单文件自动获取、追踪节点 webhook 自动回传。
- 库位编辑增强、库存冻结/调拨、面单/运费异常审批。
- 更完整的操作审计覆盖、正式站内信/邮件/短信推送、消息分组订阅和客户异常确认按钮。
