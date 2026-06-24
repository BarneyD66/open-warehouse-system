# Docker Compose Runbook

This runbook helps contributors use the repository Docker Compose setup for local PostgreSQL development.

The Compose file starts only a local PostgreSQL service. It does not start the Next.js app, seed production data, configure carrier credentials, or create a production-like deployment.

## What It Provides

- PostgreSQL 16 on port `5432`.
- Database name: `open_warehouse_system`.
- Local-only username: `warehouse`.
- Local-only password: `warehouse`.
- A named Docker volume: `open_warehouse_postgres_data`.
- A healthcheck based on `pg_isready`.

These credentials are intentionally simple for local development. Do not reuse them in hosted, shared staging, or production environments.

## Quick Start

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Check the container state:

```bash
docker compose ps
```

Configure `.env.local`:

```text
POSTGRES_URL=postgres://warehouse:warehouse@localhost:5432/open_warehouse_system
```

Initialize the schema:

```bash
npm run db:init
```

Start the app:

```bash
npm run dev
```

Open <http://localhost:3000>.

## Health Checks

Use the health status before debugging the app:

```bash
docker compose ps
docker compose logs postgres
```

If the container is running but the app cannot connect, confirm that:

- `POSTGRES_URL` or `DATABASE_URL` is set in `.env.local`.
- The host is `localhost` when running the app outside Docker.
- The port mapping still exposes `5432:5432`.
- No other local PostgreSQL service is already using port `5432`.

## Reset Local PostgreSQL

This removes the local Docker volume declared by this repository:

```bash
docker compose down -v
docker compose up -d postgres
npm run db:init
```

Do not run reset commands against production, shared staging, or any database URL copied from a hosted environment. This reset is intended only for the local Docker database.

## Local Fallback Data

The app can also run with `.local-data` fallback files when no PostgreSQL URL is configured. Docker Compose does not manage `.local-data`.

Use `docs/LOCAL_DEMO_RESET.md` if you need to reset local fallback files.

## Demo Data

The repository does not currently provide a `npm run seed:demo` command. When contributors create demo records manually or propose a seed command, they should follow `docs/DEMO_SEED_DATA_GUIDE.md`.

Demo records must be visibly fake and must not include real customer names, warehouse addresses, payment proofs, carrier credentials, production tracking data, logs, uploads, or `.env.local`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `ECONNREFUSED` | Confirm `docker compose ps` shows the `postgres` service running and healthy. |
| `Missing POSTGRES_URL or DATABASE_URL` | Confirm `.env.local` exists and the dev command was restarted after editing it. |
| Port conflict on `5432` | Stop the other local PostgreSQL service or change the left side of the Compose port mapping. |
| Schema table missing | Run `npm run db:init` after the container is healthy. |
| Local fallback files still appear | Remove `POSTGRES_URL`/`DATABASE_URL` confusion and check whether `.local-data` was created by a previous fallback run. |

## Related Docs

- `docs/LOCAL_POSTGRESQL.md`
- `docs/LOCAL_DEMO_RESET.md`
- `docs/DEMO_SEED_DATA_GUIDE.md`
- `docs/PULL_REQUEST_REVIEW_CHECKLIST.md`
- `SECURITY.md`
