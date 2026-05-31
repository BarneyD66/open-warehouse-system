import postgres from "postgres";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

let client: postgres.Sql | null = null;

export function getSql() {
  if (!connectionString) {
    throw new Error("Missing POSTGRES_URL or DATABASE_URL for PostgreSQL storage.");
  }

  if (!client) {
    client = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return client;
}

export function hasPostgresConfig() {
  return Boolean(connectionString);
}
