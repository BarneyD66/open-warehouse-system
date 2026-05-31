# PostgreSQL storage migration

The app now uses PostgreSQL as the runtime storage for inquiries, inbound ASNs, quote drafts, quote responses, SKU lines, status events, and customer isolation.

## Environment variables

Set one of these variables before running the app:

- `POSTGRES_URL`
- `DATABASE_URL`

`POSTGRES_URL` takes priority when both are present.

## Initialize schema

```bash
npm run db:init
```

This creates `warehouse_submissions` and the supporting indexes from `db/schema.sql`.

## Migrate existing local prototype data

```bash
npm run db:migrate:local
```

The migration reads `.local-data/submissions.json`, inserts each record into PostgreSQL, and preserves the full JSON payload. It is safe to rerun because rows are upserted by `id`.

## Production note

Before deploying this version, add `POSTGRES_URL` or `DATABASE_URL` to the Vercel project environment. Without a database URL, API routes that read or write submissions will return an application error because local JSON is no longer the runtime store.
