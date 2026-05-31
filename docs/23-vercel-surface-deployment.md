# Vercel 三套入口部署方案

## 目标

把当前一个原型项目拆成三套访问入口：

| 入口 | 目标用户 | 当前路由 | 无自有域名阶段 |
| --- | --- | --- | --- |
| 客户官网 | 新客户、未登录卖家 | `/`, `/services`, `/workflow`, `/pricing`, `/help`, `/contact` | `uk-warehouse-web.vercel.app` |
| 客户工作台 | 已合作客户 | `/login`, `/portal`, `/inquiry`, `/inbound`, `/tracking`, `/supplement` | `uk-warehouse-app.vercel.app` |
| 内部后台 | 我们内部客服、运营、仓库、财务 | `/ops` | `uk-warehouse-admin.vercel.app` |

后续有自有域名后再绑定：

| 入口 | 推荐域名 |
| --- | --- |
| 客户官网 | `www.yourdomain.com` |
| 客户工作台 | `app.yourdomain.com` |
| 内部后台 | `admin.yourdomain.com` |

## 当前代码已经支持

新增 `src/proxy.ts`：

- 识别 `www.*` 或 `WAREHOUSE_SURFACE=marketing` 为客户官网。
- 识别 `app.*` / `portal.*` / `customer.*` 或 `WAREHOUSE_SURFACE=customer` 为客户工作台。
- 识别 `admin.*` 或 `WAREHOUSE_SURFACE=admin` 为内部后台。
- 内部后台入口默认跳 `/ops`。
- 客户工作台入口默认跳 `/login`。

新增 `src/lib/surfaceLinks.ts`：

- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_CUSTOMER_APP_URL`
- `NEXT_PUBLIC_ADMIN_URL`

这些变量用于让三个入口之间互相跳转到正确域名。没有配置时，仍然使用本地路径，保证 `localhost:3000` 可继续开发。

## Vercel 无域名阶段推荐做法

使用同一个代码库部署三个 Vercel Project：

### 1. 客户官网项目

项目名建议：

```text
uk-warehouse-web
```

环境变量：

```text
WAREHOUSE_SURFACE=marketing
NEXT_PUBLIC_MARKETING_URL=https://uk-warehouse-web.vercel.app
NEXT_PUBLIC_CUSTOMER_APP_URL=https://uk-warehouse-app.vercel.app
NEXT_PUBLIC_ADMIN_URL=https://uk-warehouse-admin.vercel.app
```

### 2. 客户工作台项目

项目名建议：

```text
uk-warehouse-app
```

环境变量：

```text
WAREHOUSE_SURFACE=customer
NEXT_PUBLIC_MARKETING_URL=https://uk-warehouse-web.vercel.app
NEXT_PUBLIC_CUSTOMER_APP_URL=https://uk-warehouse-app.vercel.app
NEXT_PUBLIC_ADMIN_URL=https://uk-warehouse-admin.vercel.app
```

### 3. 内部后台项目

项目名建议：

```text
uk-warehouse-admin
```

环境变量：

```text
WAREHOUSE_SURFACE=admin
NEXT_PUBLIC_MARKETING_URL=https://uk-warehouse-web.vercel.app
NEXT_PUBLIC_CUSTOMER_APP_URL=https://uk-warehouse-app.vercel.app
NEXT_PUBLIC_ADMIN_URL=https://uk-warehouse-admin.vercel.app
```

## 上线后安全要求

当前 `/ops` 还是演示后台。正式上线前必须补：

- 管理员登录。
- 角色权限。
- 客户数据隔离。
- 操作日志。
- 后台访问保护，必要时加 IP 白名单或二次验证。

