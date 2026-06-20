# 126 Document Security Ledger Pass

## Scope

- Exposed document scan status and storage provider labels from `documentStore`.
- Added scan/storage badges to customer and staff document upload panels.
- Added document preview actions for previewable, non-blocked files.
- Upgraded the ops document review table with security/storage columns, summary counters, preview links, and a file security ledger export.
- Added `/api/ops/reports/documents-security` for Chinese CSV/JSON export of document security metadata.
- Added basic rate limiting for customer upload, staff upload, document download, document preview, and the document security report.

## Product Notes

- Operations can now see whether uploaded documents are clean, pending scan, or blocked without opening every file.
- Boss/ops users can export a Chinese file security ledger for audit and archive review.
- The UI now distinguishes object storage, database archive, and local file storage so production configuration issues are easier to spot.

## Verification

- Passed `npm run lint`.
- Passed `npm run build`.
- Passed conflict marker check.
- Passed `git diff --check` with only existing CRLF normalization warnings.
