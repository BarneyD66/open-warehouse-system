# Local Demo Reset Guide

This guide explains how contributors can safely reset local demo data when using Open Warehouse System without PostgreSQL.

Use this for local development only. Do not run these steps against production data, shared staging data, customer files, or any database configured through `POSTGRES_URL` or `DATABASE_URL`.

## What Local Fallback Data Is

When no PostgreSQL connection is configured, the app can use local fallback files under `.local-data`.

Those files may contain local test accounts, fake orders, fake warehouse tasks, generated documents, or temporary workflow state created while running the app locally.

`.local-data` is local-only generated data. It should not be committed, copied into public issues, or used for screenshots unless it is known to contain only fake demo data.

## Before Resetting

Check the current mode:

```bash
node -e "console.log(Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL) ? 'postgres' : 'local-fallback')"
```

If you use `.env.local`, inspect it manually and confirm that `POSTGRES_URL` and `DATABASE_URL` are not pointing to production or shared staging.

Before deleting anything:

- Stop the dev server.
- Confirm you are inside the project root.
- Confirm the target path is exactly `.local-data`.
- Confirm the data is local fake/demo data.
- Do not delete files outside the repository.

## Optional Backup

If you want to keep a temporary local backup:

```bash
Copy-Item -Recurse -LiteralPath .local-data -Destination .local-data.backup
```

Do not commit `.local-data.backup`.

## Reset Local Fallback Data

PowerShell:

```powershell
if (Test-Path -LiteralPath ".local-data") {
  Remove-Item -Recurse -Force -LiteralPath ".local-data"
}
```

Then start the app again:

```bash
npm run dev
```

The app will recreate local fallback files as needed.

## Reset Local PostgreSQL Instead

If you are using the Docker PostgreSQL path, follow `docs/LOCAL_POSTGRESQL.md` instead:

```bash
docker compose down -v
docker compose up -d postgres
npm run db:init
```

This resets the Docker PostgreSQL volume. It does not reset `.local-data`.

## Public Demo Data Rules

Any reset, seed, screenshot, or issue reproduction should use fake data only:

- Fake customers.
- Fake contacts.
- Fake warehouse addresses.
- Fake SKUs.
- Fake tracking numbers.
- Fake billing records.
- Fake document names.

Chinese-mode customer-facing CSV/Excel templates, export headers, and sample rows should remain Chinese-first. English field names may exist as internal aliases, but they should not replace Chinese customer-facing examples.

## Related Docs

- `docs/DEMO_DATA_PLAN.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/SCREENSHOT_GUIDE.md`
- `SECURITY.md`
