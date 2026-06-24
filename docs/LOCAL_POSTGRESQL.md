# Local PostgreSQL Setup

This guide helps contributors run Open Warehouse System with a local PostgreSQL database.

The app can still run with local fallback data for lightweight demos. PostgreSQL is useful when you want to test schema migrations, persistence behavior, or production-oriented workflows.

For a shorter command-oriented Docker Compose checklist, see `docs/DOCKER_COMPOSE_RUNBOOK.md`.

## Prerequisites

- Node.js 20 or newer.
- Docker Desktop or another Docker-compatible runtime.
- Project dependencies installed with `npm install`.

## Start PostgreSQL

```bash
docker compose up -d postgres
```

The development database uses these local-only defaults:

```text
Database: open_warehouse_system
User: warehouse
Password: warehouse
Port: 5432
```

Do not reuse these credentials in production.

## Configure `.env.local`

Copy `.env.example` if you have not already done so:

```bash
cp .env.example .env.local
```

Set one of the database URLs:

```text
POSTGRES_URL=postgres://warehouse:warehouse@localhost:5432/open_warehouse_system
```

`DATABASE_URL` is also supported, but `POSTGRES_URL` is the preferred local example because the existing scripts read it first.

## Initialize the Schema

```bash
npm run db:init
```

This runs `db/schema.sql` against the configured database.

## Optional: Migrate Local Demo Data

If you already have `.local-data/submissions.json`, you can migrate the local submissions into PostgreSQL:

```bash
npm run db:migrate:local
```

If the file does not exist, the migration script exits without changing the database.

## Run the App

```bash
npm run dev
```

Open <http://localhost:3000>.

## Reset Local Database State

To remove the local PostgreSQL volume and start clean:

```bash
docker compose down -v
docker compose up -d postgres
npm run db:init
```

This deletes only the Docker volume declared in `docker-compose.yml`. It does not delete `.local-data`.

## Troubleshooting

- `Missing POSTGRES_URL or DATABASE_URL`: check `.env.local` and restart the command.
- `ECONNREFUSED`: confirm the container is running with `docker compose ps`.
- Port conflict on `5432`: stop the other local PostgreSQL service or change the left side of the port mapping in `docker-compose.yml`.
- Schema errors after pulling new changes: run `npm run db:init` again; the schema uses `create table if not exists` for the current starter workflow.
