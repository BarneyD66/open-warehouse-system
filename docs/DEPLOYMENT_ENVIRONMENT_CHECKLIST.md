# Deployment Environment Checklist

Use this checklist before deploying Open Warehouse System to a hosted preview, staging environment, public demo, or production-like environment.

This project is still an early `0.x` WMS starter. A deployment should be treated as an operational surface: environment variables, auth switches, database URLs, file handling, public media, and regional assumptions must be reviewed before sharing links.

## Deployment Scope

Document the target before deploying:

- Environment name:
- Purpose: local preview / public demo / staging / production-like review
- Host provider:
- Public URL:
- Data mode: local fallback / PostgreSQL / hosted database
- Demo data source:
- Staff access mode:
- Customer access mode:
- External providers enabled:

Do not label a deployment as production-ready unless auth, storage, database, backup, monitoring, and data-retention decisions have been reviewed by maintainers.

## Required Environment Variables

Confirm these are configured intentionally:

- `NODE_ENV`
- `SESSION_SECRET`
- `STAFF_WHITELIST_JSON`
- `POSTGRES_URL` or `DATABASE_URL`
- `ALLOW_DEMO_LOGIN`
- `ALLOW_DEMO_STAFF_LOGIN`
- `CUSTOMER_PASSWORD_RESET_TOKEN`
- `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_CUSTOMER_APP_URL`
- `NEXT_PUBLIC_ADMIN_URL`

Rules:

- `SESSION_SECRET` must be long, random, and environment-specific.
- `STAFF_WHITELIST_JSON` must not use demo credentials in shared or production-like environments.
- Demo login switches must be disabled in production-like environments.
- Hosted database URLs must not be copied into docs, screenshots, issues, or support messages.
- Public `NEXT_PUBLIC_*` values should not reveal private admin URLs unless the environment is intentionally public.

Use `docs/SECRET_HANDLING_CHECKLIST.md` before adding or changing variables.

## Data And Storage

Before sharing a deployed URL:

- Confirm whether the app is using local fallback data or PostgreSQL.
- Confirm demo data is visibly fake.
- Confirm no `.local-data`, upload folder, database dump, or local log was deployed as a public asset.
- Confirm document download and preview routes do not expose another customer's files.
- Confirm payment proof and billing files are fake or disabled.
- Confirm backup and restore routes are protected or disabled outside trusted admin review.

If object storage is added later, document:

- Bucket name pattern.
- Access-control model.
- Signed URL behavior.
- Retention policy.
- Malware scanning or manual review expectation.

## Authentication And Access

Check:

- Customer sessions cannot access another customer's data.
- Staff-only pages and APIs require staff session validation.
- Password reset tokens are not public or guessable.
- Demo staff credentials are disabled outside local-only demos.
- Admin and ops routes are not linked from public marketing pages unless intended.
- Cookies and session behavior match the deployment host and domain.

High-risk changes should follow `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`.

## External Integrations

For carrier, marketplace, payment, notification, or webhook integrations:

- Use sandbox credentials only in preview/staging.
- Keep production credentials out of public docs and logs.
- Use fake provider payload examples in issues and PRs.
- Confirm webhook endpoints do not log secrets.
- Confirm retry jobs cannot affect real orders unless the environment is explicitly production-like and approved.
- Document whether the integration is mock, sandbox, or production.

Do not enable real carrier labels, marketplace fulfillment, payment review, or production webhooks in a public demo.

## Public Demo And Media

If the deployment will be used for screenshots, video, README media, or Codex for OSS application materials:

- Follow `docs/PUBLIC_DEMO_CHECKLIST.md`.
- Use fake customer, SKU, order, tracking, billing, and warehouse data.
- Hide browser bookmarks, personal accounts, provider dashboards, and environment values.
- Confirm Chinese-mode customer-facing exports, templates, and sample rows remain Chinese-first.
- Avoid compliance claims about tax, customs, privacy, labor, or carrier rules.

## Regional Assumptions

If the deployment claims support for a market or region:

- Fill out `docs/REGION_PROFILE_TEMPLATE.md`.
- Document default language, currency, date format, address fields, carrier assumptions, tax/customs fields, privacy assumptions, and billing terms.
- Keep provider-specific behavior behind adapters or configuration.
- Use `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for downloads and printable artifacts.

## Verification

Minimum checks:

```bash
git diff --check
npm run lint
```

For code or runtime behavior changes:

```bash
npm run build
```

For PostgreSQL-backed deployments:

```bash
npm run db:init
```

Manual smoke routes:

- `/`
- `/login`
- `/portal`
- `/ops-login`
- `/ops`
- `/warehouse`
- `/tracking`

Record checked routes and data mode in the pull request or release note.

## Reject Criteria

Do not share or promote the deployment if:

- Real customer data is present.
- Demo login is enabled in a production-like environment.
- Staff-only routes are reachable without staff auth.
- Hosted database URLs, provider secrets, logs, or `.env.local` are visible.
- File downloads expose cross-customer data.
- Public media includes private browser or provider dashboard content.
- The deployment implies legal, tax, customs, privacy, labor, or carrier compliance that has not been validated.

## Related Docs

- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/SMOKE_TEST_PLAN.md`
- `docs/REGION_PROFILE_TEMPLATE.md`
- `docs/PRIVACY_DATA_RETENTION_GUIDE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `SECURITY.md`
