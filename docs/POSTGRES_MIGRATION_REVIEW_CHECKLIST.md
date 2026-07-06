# PostgreSQL Migration Review Checklist

Use this checklist when changing PostgreSQL schema, data access code, migration scripts, or workflows that depend on persisted warehouse data.

Open Warehouse System still supports local fallback data for lightweight demos. PostgreSQL changes therefore need to preserve two expectations: contributors can keep running the project locally, and deployments can review migration risk before touching real data.

## Scope

Apply this checklist to changes in:

- `db/schema.sql`
- `scripts/init-postgres.mjs`
- `scripts/migrate-local-json-to-postgres.mjs`
- Repository or store code that reads or writes PostgreSQL data.
- API routes that depend on PostgreSQL-backed records.
- Backup, restore, export, retention, or reporting flows that rely on database state.

## Before Changing Schema

Document the intended workflow:

- Which user surface changes: customer portal, ops workbench, warehouse workbench, API, export, or report.
- Which table or domain is affected: customer, inbound, outbound, inventory, returns, billing, carrier, file, audit, or integration data.
- Whether the change affects `customer_code` isolation or staff-only data.
- Whether local fallback behavior should remain unchanged.
- Whether existing rows need a backfill, default value, or manual cleanup.
- How to roll back the change in a local or staging database.

Do not test with production data, hosted production database URLs, real customer files, payment proofs, carrier credentials, or private pricing sheets.

## Schema Review

Check that the schema change:

- Keeps customer-owned records scoped by `customer_code` or another explicit access boundary.
- Adds indexes for fields used by list pages, filters, exports, or background jobs.
- Uses constraints where they protect important workflow invariants.
- Handles timestamps consistently, including created and updated times when operational history matters.
- Avoids destructive drops or rewrites unless the PR explains the migration path and rollback risk.
- Keeps enum-like status values documented in code, seed data, or contributor docs.
- Does not embed region-specific tax, customs, carrier, or labor assumptions directly into generic tables unless the field is explicitly configurable.

## Migration Script Review

Check that scripts:

- Are idempotent where practical, especially for table creation and starter setup.
- Fail clearly when `POSTGRES_URL` or `DATABASE_URL` is missing.
- Use fake demo data only.
- Do not read or publish `.local-data`, logs, database dumps, uploaded files, or `.env.local` in public examples.
- Exit safely when optional local fallback files do not exist.
- Include enough console output for contributors to understand what changed without printing secrets or raw customer records.

## Access And Security Review

For any workflow that reads from or writes to PostgreSQL:

- Customer sessions must not access another customer's records.
- Staff-only APIs must require staff session validation.
- File, billing, payment, return, and carrier data must preserve the same access boundary as the source workflow.
- Backup and restore routes must remain protected or disabled outside trusted admin review.
- Logs must not include credentials, full database URLs, payment proofs, private files, or raw provider payload secrets.

Use `docs/SECRET_HANDLING_CHECKLIST.md` and `docs/PRIVACY_DATA_RETENTION_GUIDE.md` for sensitive data review.

## Localization And Export Review

If the database change affects downloadable artifacts:

- Confirm Chinese-mode customer-facing CSV, Excel, template, and sample-row outputs remain Chinese-first.
- Keep English field names as internal aliases when integrations need stable keys.
- Do not expose internal compatibility fields as customer-facing labels unless the related workflow explicitly requires it.
- Re-check printable artifacts and reports, not only page text.

Use `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for export-specific review.

## Verification

For documentation-only migration planning:

```bash
git diff --check
```

For schema, migration script, or repository changes:

```bash
npm run lint
npm run db:init
```

For runtime behavior changes:

```bash
npm run build
```

Manual smoke routes when the change affects user workflows:

- `/login`
- `/portal`
- `/ops-login`
- `/ops`
- `/warehouse`
- `/tracking`

Record the checked data mode: local fallback, local PostgreSQL, hosted staging database, or public demo.

## PR Note Template

```markdown
### PostgreSQL migration review

- Data mode checked:
- Tables or stores changed:
- Customer isolation impact:
- Local fallback impact:
- Backfill or default behavior:
- Rollback note:
- Verification run:
- Demo data used:
```

## Reject Criteria

Do not merge or promote the change if:

- It requires production data to validate.
- It weakens customer isolation or staff-only boundaries.
- It drops or rewrites data without a documented migration path.
- It prints secrets, database URLs, provider payload secrets, or raw customer records.
- It changes customer-facing export labels without checking Chinese-first output.
- It depends on unreviewed tax, customs, privacy, labor, or carrier compliance assumptions.

## Related Docs

- `docs/LOCAL_POSTGRESQL.md`
- `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/PRIVACY_DATA_RETENTION_GUIDE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
