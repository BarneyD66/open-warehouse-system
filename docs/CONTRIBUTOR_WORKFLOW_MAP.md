# Contributor Workflow Map

This map helps contributors choose a small Open Warehouse System workflow without reading the whole codebase first.

Use it with `docs/CONTRIBUTOR_QUICK_PATH.md`, `docs/ROADMAP_REVIEW_CHECKLIST.md`, and `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`.

## How To Use This Map

Before opening an issue or pull request, choose:

- One workflow row from the table below.
- One user role.
- One visible route or API boundary.
- One verification command.
- Fake demo data only.

Avoid mixing customer, ops, warehouse, billing, logistics, and regional adaptation changes in the same first contribution.

## Workflow Areas

| Area | User role | Public route or surface | API or code boundary | Useful docs | Good first contribution shape |
| --- | --- | --- | --- | --- | --- |
| Customer access | Customer | `/login`, `/portal`, `/account`, `/workspace` | `src/app/api/login`, `src/app/api/register`, customer account stores | `docs/STAFF_AUTH.md`, `docs/DEMO_WALKTHROUGH.md` | Clarify login copy, add one safe demo note, or improve one empty/error state. |
| Inbound receiving | Customer, ops, warehouse | `/inbound`, `/ops`, `/warehouse` | `src/app/api/inbounds`, `src/app/api/warehouse/inbounds` | `docs/SMOKE_TEST_PLAN.md`, `docs/DEMO_DATA_PLAN.md` | Document one receiving state or add a smoke-test checklist for fake inbound records. |
| SKU and inventory | Customer, ops, warehouse | `/skus`, `/ops`, `/warehouse` | `src/app/api/skus`, inventory and location stores | `docs/POSTGRES_MIGRATION_REVIEW_CHECKLIST.md` | Review one SKU or stock adjustment workflow for persistence and audit expectations. |
| Outbound fulfillment | Customer, ops, warehouse | `/outbound`, `/ops`, `/warehouse`, print pages | `src/app/api/outbounds`, warehouse outbound APIs | `docs/DEMO_WALKTHROUGH.md`, `docs/PUBLIC_DEMO_CHECKLIST.md` | Improve one outbound status explanation or document a fake pick-pack-ship path. |
| Returns | Customer, ops, warehouse | `/returns`, `/ops`, return print pages | `src/app/api/returns`, returns tracking APIs | `docs/SMOKE_TEST_PLAN.md`, `docs/EXPORT_LOCALIZATION_CHECKLIST.md` | Clarify one RMA or return-tracking workflow using fake records only. |
| Tracking and logistics | Customer, ops | `/tracking`, `/ops` logistics panels | `src/app/api/tracking`, carrier webhook and tracking APIs | `docs/MOCK_CARRIER_ADAPTER.md`, `docs/SECRET_HANDLING_CHECKLIST.md` | Add mock-provider notes or document one tracking exception path without real carrier credentials. |
| Billing and statements | Customer, ops, finance | `/billing`, `/ops` billing surfaces | billing export, statement, and charge-event APIs | `docs/EXPORT_LOCALIZATION_CHECKLIST.md`, `docs/PRIVACY_DATA_RETENTION_GUIDE.md` | Review one invoice/export field list with fake rows and Chinese-first customer-facing labels. |
| Warehouse execution | Warehouse staff | `/warehouse`, `/pda`, print labels and pick lists | warehouse scan, task, location, and pick-wave APIs | `docs/SMOKE_TEST_PLAN.md`, `docs/SCREENSHOT_GUIDE.md` | Improve a mobile warehouse checklist or document one scan failure state. |
| Ops system review | Maintainer, ops | `/ops` reports and system panels | audit, backup, restore, launch-readiness, system health APIs | `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`, `docs/SECRET_HANDLING_CHECKLIST.md` | Document one staff-only safety boundary or verification note. |
| Regional adaptation | Regional contributor | Customer routes, exports, templates, docs | locale-sensitive labels, exports, region profile docs | `docs/REGION_PROFILE_TEMPLATE.md`, `docs/REGIONAL_ADAPTATION_GUIDE.md` | Fill one workflow review template before translating or adding country-specific behavior. |

## Suggested Small PR Slices

Good first pull requests usually fit one of these shapes:

- Add or clarify one row in a workflow checklist.
- Add one safe fake-data example.
- Add one manual smoke-test path for a route.
- Document one customer-facing export field list.
- Add one region-profile assumption for a planned market.
- Improve one empty, loading, or error state without changing persistence.
- Add one Playwright smoke test for a stable route.

Avoid first pull requests that:

- Change multiple workflows at once.
- Add real provider credentials, API keys, private pricing, labels, or production screenshots.
- Claim country-specific compliance without a region profile and review evidence.
- Replace local fallback persistence without a migration and rollback checklist.
- Refactor shared auth, billing, inventory, or logistics code without a focused issue.

## Verification By Change Type

| Change type | Minimum verification |
| --- | --- |
| Documentation only | `git diff --check` |
| UI copy or route rendering | `npm run lint`, `npm run build` |
| API, store, auth, billing, inventory, logistics, or warehouse code | `npm run lint`, `npm run build`, route-specific manual smoke notes |
| PostgreSQL schema or persistence | `npm run lint`, `npm run build`, `npm run db:init`, migration rollback notes |
| Public screenshots or demo media | `git diff --check`, plus `docs/PUBLIC_DEMO_CHECKLIST.md` and `docs/SCREENSHOT_GUIDE.md` |
| Regional adaptation | `git diff --check`, `npm run lint`, completed `docs/REGION_PROFILE_TEMPLATE.md` notes |

## Issue Template Starter

```md
Title: docs: map one outbound exception path for contributors

Workflow area: outbound fulfillment
Role: warehouse staff
Route/API: /warehouse and src/app/api/warehouse/outbounds
Data: fake outbound records only
Scope:
- Document the current status path.
- Identify one unclear error state.
- Add a verification note.
Verification:
- git diff --check
```

## Related Docs

- `docs/CONTRIBUTOR_QUICK_PATH.md`
- `docs/CONTRIBUTOR_ONBOARDING.md`
- `docs/ROADMAP_REVIEW_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/DEMO_WALKTHROUGH.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
