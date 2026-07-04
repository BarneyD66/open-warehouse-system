# Privacy And Data Retention Guide

This guide documents privacy and data-retention assumptions for Open Warehouse System contributors and maintainers.

It is not legal advice. The project does not claim out-of-the-box privacy compliance for any country or region. Treat this as an engineering checklist for deciding what must be configurable, documented, reviewed, or disabled before a real deployment.

## Data Categories

Review retention and access rules for each category:

| Category | Examples | Default Public-doc Rule |
| --- | --- | --- |
| Customer profile | company name, contact, email, phone, tax identifiers | Use fake demo values only. |
| Warehouse operations | inbound ASN, SKU, inventory, outbound, return/RMA, locations | Use fake workflow IDs and fake SKUs. |
| Documents | product photos, certificates, proof files, invoices, labels | Do not publish real files. |
| Billing | statements, disputes, payment references, fee lines | Use fake billing records only. |
| Carrier data | labels, tracking events, account IDs, webhook payloads | Use fake payloads and mock adapters. |
| Auth and access | sessions, staff whitelist, reset tokens, audit events | Never publish secrets or real users. |
| Logs and audit | action logs, retry logs, integration logs, error traces | Redact secrets and customer data. |

## Retention Questions

Before deploying or proposing a retention policy, answer:

- Which data categories are stored?
- Which data is required for warehouse operations?
- Which data is required for billing review?
- Which data is required for audit or dispute handling?
- Which data can be deleted or anonymized?
- Which data should never be exported publicly?
- Which users can request export or deletion?
- Which staff roles can access retained records?
- Which backups retain deleted records, and for how long?
- Which logs may contain customer identifiers or provider payloads?

Document region-specific assumptions in `docs/REGION_PROFILE_TEMPLATE.md`.

## Access Boundaries

Core access expectations:

- Customer-facing reads and writes must remain scoped to the authenticated customer identity.
- Staff-only APIs must require staff session validation.
- File downloads must not expose files across customers.
- Billing, payment proof, document, and return/RMA evidence must remain customer-scoped or staff-scoped.
- Public demos must use fake data only.

Use `docs/PULL_REQUEST_REVIEW_CHECKLIST.md` for changes that touch these boundaries.

## Export And Deletion

If data export or deletion is implemented:

- Make the requester identity explicit.
- Record what data categories are included.
- Exclude secrets, provider credentials, internal staff notes, and cross-customer records.
- Use customer-facing language consistently with the selected locale.
- Keep Chinese-mode CSV/Excel headers and sample rows Chinese-first.
- Keep internal English aliases behind export mapping or presenter code.
- Document whether deletion is hard delete, soft delete, anonymization, or retention-limited archive.

Use `docs/EXPORT_LOCALIZATION_CHECKLIST.md` for customer-facing export artifacts.

## Backup And Restore

Backup and restore workflows are high risk because they may reintroduce deleted data or expose private records.

Before enabling backup or restore in a shared environment:

- Confirm staff-only access.
- Confirm backup location and access control.
- Confirm retention period.
- Confirm whether deleted records remain in backups.
- Confirm restore scope: full environment, customer-specific, or workflow-specific.
- Confirm no backup artifacts are committed or exposed as public assets.

Deployment review should follow `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`.

## Logs And Integration Payloads

Logs should not contain:

- Access tokens, refresh tokens, webhook secrets, signed payload secrets, or API keys.
- Full provider request/response bodies with account IDs or customer data.
- Payment proof details.
- Customer documents or labels.
- Full `.env.local` content.

If logs are needed for support or issue reproduction, create a fake reproduction and redact private values.

## Regional Notes

For each region profile, document:

- Expected data retention windows.
- Customer data export expectation.
- Customer deletion expectation.
- Audit log retention expectation.
- Staff access review expectation.
- Backup retention expectation.
- Local privacy caveats.

Do not present these notes as legal advice. They are engineering inputs for local review.

## Public Artifact Rules

Public issues, pull requests, screenshots, README media, release notes, and Codex for OSS application materials must use fake data only.

Do not publish:

- Real customer records.
- Production labels or tracking payloads.
- Payment proofs or invoices.
- Database dumps or `.local-data`.
- Logs with secrets or customer identifiers.
- Private warehouse addresses.
- Provider dashboards or admin consoles with real data.

## Related Docs

- `SECURITY.md`
- `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
- `docs/PUBLIC_DEMO_CHECKLIST.md`
- `docs/REGION_PROFILE_TEMPLATE.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
