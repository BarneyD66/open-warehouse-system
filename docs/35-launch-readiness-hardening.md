# 上线前加固与体检

## 本轮完成

- 新增公开健康检查接口：`/api/health`。
- 新增员工可看的上线体检接口：`/api/ops/launch-readiness`。
- 运营后台 `/ops` 新增“上线体检”卡片，集中展示共享数据库、资料持久化、三端域名、员工白名单、演示登录、客户账号和业务闭环状态。
- 客户账号 `customerAccountStore` 支持 Postgres 优先存储，生产环境不再只依赖 Vercel `/tmp`。
- 资料上传 `documentStore` 支持 Postgres 优先存储，文件内容写入 `warehouse_documents.payload.bytesBase64`，避免 Vercel 临时文件目录丢失。
- 文档下载接口改为从统一 `getDocumentBytes` 读取，兼容数据库和本地文件两种模式。

## 上线体检规则

- 共享数据库：检查 `POSTGRES_URL` 或 `DATABASE_URL` 是否可连接。
- 资料持久化：有 Postgres 时视为可上线，生产无 Postgres 视为阻塞。
- 三端域名：检查 `NEXT_PUBLIC_CUSTOMER_APP_URL`、`NEXT_PUBLIC_ADMIN_URL`、`NEXT_PUBLIC_MARKETING_URL`。
- 员工白名单：生产需要 `STAFF_WHITELIST_JSON`。
- 演示登录：生产不能开启 `ALLOW_DEMO_LOGIN` 或 `ALLOW_DEMO_STAFF_LOGIN`。
- 客户账号：统计客户档案和注册账号。
- 仓储物流闭环：统计出库、退货和账单数据是否可支撑日常操作。
- 账单对账闭环：检查月结单状态字段是否已被使用。

## 验证

- `npm run lint` 通过。
- `npm run build` 通过，构建清单包含 `/api/health` 和 `/api/ops/launch-readiness`。
- 本地 `/api/health` 返回 200 且包含 `score`。
- 本地运营后台 `/ops` 可渲染“上线体检”卡片。
- 本地员工接口 `/api/ops/launch-readiness` 返回 200 且包含 checks。

## 生产上线注意

- 如果生产体检显示员工白名单阻塞，需要在 Vercel 配置 `STAFF_WHITELIST_JSON`。
- 如果生产体检显示共享数据库阻塞，需要确认三个项目都配置同一组 `POSTGRES_URL` 或 `DATABASE_URL`。
- 旧的本地上传文件不会自动进入数据库，需要通过后台重新上传或后续补一次迁移脚本。
