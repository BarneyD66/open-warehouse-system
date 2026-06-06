# Staff Authentication and Demo Login

This document explains how Open Warehouse System separates local demo access from production staff authentication.

## Local Demo Access

In development, the app can use a small built-in staff whitelist so contributors can explore the ops and warehouse workbenches without setting up an identity provider.

| Role | Route | Username | Password | Default landing |
| --- | --- | --- | --- | --- |
| Ops | `/ops-login` | `ops` | `Ops@2026Test` | `/ops` |
| Warehouse | `/ops-login` | `warehouse` | `Warehouse@2026Test` | `/warehouse` |
| Admin | `/ops-login` | `admin` | `Admin@2026Test` | `/ops` |

These accounts are for local demos and screenshots only. Do not reuse them in production.

Customer access is different: customers register through `/login` or `/workspace`, and passwords are stored as hashes. The project no longer uses a fixed `test / test` customer login for the current MVP.

## Environment Variables

Production deployments should configure:

```env
SESSION_SECRET=replace-with-a-long-random-secret
STAFF_WHITELIST_JSON=[{"username":"ops@example.com","password":"replace-with-a-strong-password","displayName":"Ops Lead","role":"ops"}]
POSTGRES_URL=postgres://...
DATABASE_URL=postgres://...
```

`POSTGRES_URL` and `DATABASE_URL` may point to the same database depending on the hosting provider.

Use one of these staff roles:

| Role | Intended scope |
| --- | --- |
| `admin` | configuration, customer review, sensitive approvals, ops access |
| `ops` | customer service, inbound, outbound, billing, logistics and exception workflows |
| `warehouse` | receiving, putaway, picking, packing, handoff and warehouse task workflows |
| `finance` | billing and finance-oriented workflows |

## Production Rules

- Set a strong `SESSION_SECRET`.
- Set `STAFF_WHITELIST_JSON` with real staff accounts and strong passwords.
- Keep `ALLOW_DEMO_LOGIN` unset or `false`.
- Keep `ALLOW_DEMO_STAFF_LOGIN` unset or `false`.
- Do not commit `.env.local`, production credentials, database URLs, carrier API keys, or customer data.
- Rotate staff passwords before sharing a staging or production URL outside the maintainer group.

## Review Checklist

Before publishing screenshots, demos, or a release:

- Confirm demo access is clearly marked as local-only.
- Confirm production docs do not expose real staff emails, credentials, database URLs, or carrier account details.
- Confirm customer-facing Chinese-mode exports and templates still use Chinese headers and examples.
- Confirm staff-only APIs require a staff session.
- Confirm customer APIs scope data by customer identity.
