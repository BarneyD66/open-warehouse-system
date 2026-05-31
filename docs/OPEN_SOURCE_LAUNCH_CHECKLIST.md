# Open-source Launch Checklist

这份清单用于把本地项目发布成公开 GitHub 仓库，并准备 Codex for OSS 申请。

## Before Publishing

- [ ] 确认 `.env.local`、`.local-data`、`logs`、`tmp`、`test-artifacts` 没有被提交。
- [ ] 检查仓库里没有真实客户姓名、手机号、邮箱、地址、付款凭证、生产数据库连接串。
- [ ] 确认 README 顶部截图能正常显示。
- [ ] 确认 `LICENSE`、`CONTRIBUTING.md`、`SECURITY.md`、`ROADMAP.md` 存在。
- [ ] 运行 `npm run lint`。
- [ ] 运行 `npm run build`。

## Create GitHub Repository

建议仓库名：

```text
open-warehouse-system
```

建议描述：

```text
Chinese-first open-source WMS starter for cross-border warehouse, fulfillment, inventory, billing, returns, and 3PL operations.
```

建议 topics：

```text
wms, warehouse, fulfillment, logistics, inventory, 3pl, cross-border, nextjs, react, typescript, postgres
```

## Push Commands

仓库地址按当前 GitHub 登录用户设置为 `BarneyD66/open-warehouse-system`。

```bash
git remote add origin https://github.com/BarneyD66/open-warehouse-system.git
git branch -M main
git add .
git commit -m "docs: package project for open source launch"
git push -u origin main
```

如果仓库已有 remote：

```bash
git remote set-url origin https://github.com/BarneyD66/open-warehouse-system.git
git push -u origin main
```

## After Publishing

- [ ] 在 GitHub About 区域填写 description、website 和 topics。
- [ ] 打开 Issues 和 Discussions。
- [ ] 创建 `good first issue` 和 `help wanted` 标签。
- [ ] 从 `docs/INITIAL_ISSUES.md` 复制首批 issues。
- [ ] 创建 `v0.1.0` release。
- [ ] 把公开 repo 链接填入 `docs/CODEX_FOR_OSS_APPLICATION.md`。
- [ ] 找朋友 star/fork 前，先确认 README 首页图片、CI 和 issue 模板正常。

## Codex for OSS Application

申请链接：

<https://openai.com/zh-Hans-CN/form/codex-for-oss/>

申请前建议准备：

- 公开 GitHub 仓库链接
- 维护者身份说明
- 项目为什么对开源生态有价值
- 当前 star/fork/issue/PR 数据
- Codex/API credits 的具体使用计划
