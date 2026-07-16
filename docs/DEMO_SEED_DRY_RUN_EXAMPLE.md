# Demo Seed Dry-run Example

This document shows the expected output shape for a future demo seed preview command.

The project does not currently ship this command. Treat the examples below as a review target for contributors before implementing `npm run seed:demo -- --dry-run`.

## Goals

A dry run should help maintainers and reviewers confirm:

- Which fake records would be created or updated.
- Which storage mode would be used: local fallback or PostgreSQL.
- Which customer, SKU, inbound, outbound, return, billing, and notification scenarios are covered.
- That no real customer data, secrets, production database URLs, uploads, logs, or `.env.local` content are read or printed.
- That Chinese-mode customer-facing examples stay Chinese-first while internal aliases remain implementation details.

## Command Shape

Future command:

```bash
npm run seed:demo -- --dry-run
```

Expected behavior:

- Refuse to run when `NODE_ENV=production`.
- Print the detected data mode without printing connection strings.
- Print deterministic fake IDs and record counts.
- Print a customer-facing export preview with Chinese headers.
- Exit without writing to `.local-data` or PostgreSQL.

## Example Console Output

```text
Open Warehouse System demo seed dry run

Mode
- node env: development
- data mode: local-fallback
- write mode: dry-run, no records will be written

Safety checks
- production mode: blocked if NODE_ENV=production
- secrets: not read from .env.local
- uploads/logs/private spreadsheets: not read
- database URL: not printed

Scenario summary
- customers: 2
- skus: 6
- inbound ASNs: 2
- inventory balances: 6
- outbound orders: 4
- returns: 2
- billing lines: 8
- notifications: 4

Customer records
- DEMO-CUSTOMER-001 | 示例客户A | verified | customer portal
- DEMO-CUSTOMER-002 | 示例客户B | pending_review | ops review

SKU records
- SKU-DEMO-001 | 蓝牙耳机 | bluetooth-headset | small parcel
- SKU-DEMO-002 | 厨房收纳架 | kitchen-rack | medium parcel
- SKU-DEMO-003 | 折叠桌 | folding-table | oversized

Workflow records
- ASN-DEMO-001 | DEMO-CUSTOMER-001 | carton receiving | expected
- OUT-DEMO-001 | DEMO-CUSTOMER-001 | pick-pack-handoff | ready_to_pick
- RMA-DEMO-001 | DEMO-CUSTOMER-001 | relabel required | awaiting_customer_resolution
- BILL-DEMO-001 | DEMO-CUSTOMER-001 | storage + outbound + carrier | draft

No data was written.
```

## Customer-facing Export Preview

If the dry run prints a CSV or Excel preview, customer-facing headers should stay Chinese-first:

```csv
客户代码,订单号,SKU编码,中文品名,数量,状态,跟踪号
DEMO-CUSTOMER-001,OUT-DEMO-001,SKU-DEMO-001,蓝牙耳机,2,待拣货,TRK-DEMO-0001
DEMO-CUSTOMER-001,OUT-DEMO-002,SKU-DEMO-002,厨房收纳架,1,已交接,TRK-DEMO-0002
```

Internal aliases can exist in code, but they should not replace customer-facing Chinese headers in Chinese-mode exports.

## Review Checklist

Before implementing or changing the dry-run command:

- Confirm all examples are visibly fake.
- Confirm no production data source is required.
- Confirm the command cannot write data in dry-run mode.
- Confirm the output does not print secrets, database URLs, full provider payloads, upload paths, or raw local files.
- Confirm customer-facing CSV/Excel examples remain Chinese-first.
- Run `git diff --check` for docs-only changes.
- Run `npm run lint` if script code is added.
- Run `npm run build` if app behavior changes.

## Related Docs

- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/GOOD_FIRST_ISSUE_DRAFTS.md`
- `docs/LOCAL_DEMO_RESET.md`
- `docs/LOCAL_POSTGRESQL.md`
- `docs/EXPORT_LOCALIZATION_CHECKLIST.md`
- `docs/SECRET_HANDLING_CHECKLIST.md`
