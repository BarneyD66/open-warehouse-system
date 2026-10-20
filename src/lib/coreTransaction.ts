import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { getSql, hasPostgresConfig } from "./db";

type Mutation = {
  sql?: postgres.Sql;
  files: Map<string, string>;
  committed: Array<() => void>;
};
const scope = new AsyncLocalStorage<Mutation>();

// Only warehouse-core uses this accessor. Other stores keep their existing clients.
export function coreSql() { return scope.getStore()?.sql ?? getSql(); }
export function afterCoreCommit(callback: () => void) {
  const mutation = scope.getStore();
  if (!mutation) throw new Error("Warehouse mutation context is required");
  mutation.committed.push(callback);
}
export async function readCoreFile(file: string) {
  return scope.getStore()?.files.get(file) ?? await readFile(file, "utf8");
}
export function stageCoreFile(file: string, content: string) {
  const mutation = scope.getStore();
  if (!mutation) throw new Error("Warehouse mutation context is required");
  mutation.files.set(file, content);
}

async function localLock(file: string) {
  await mkdir(path.dirname(file), { recursive: true });
  const lock = file + ".mutation-lock";
  const until = Date.now() + 30_000;
  while (true) {
    try {
      const handle = await open(lock, "wx");
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      return async () => { await handle.close(); await rm(lock); };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
      // Never remove a lock owned by another process. A crashed owner requires recovery.
      if (Date.now() >= until) throw new Error("Warehouse data is busy; retry after the active operation finishes");
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }
}

export async function withCoreMutation<T>(work: () => Promise<T>, prepare: () => Promise<void>, file: string): Promise<T> {
  if (scope.getStore()) return work();
  const mutation: Mutation = { files: new Map(), committed: [] };
  let result: T;
  if (hasPostgresConfig()) {
    // DDL preparation is deliberately outside the transaction: do not cache rolled-back schema.
    await prepare();
    result = await getSql().begin(async sql => {
      // Every legacy snapshot writer participates, before reading, across workers/instances.
      await sql`select pg_advisory_xact_lock(782419032)`;
      mutation.sql = sql as unknown as postgres.Sql;
      return scope.run(mutation, work);
    }) as T;
  } else {
    const unlock = await localLock(file);
    try {
      result = await scope.run(mutation, work);
      for (const [target, content] of mutation.files) {
        const temporary = target + "." + randomUUID() + ".tmp";
        try {
          const handle = await open(temporary, "wx");
          try { await handle.writeFile(content, "utf8"); await handle.sync(); }
          finally { await handle.close(); }
          await rename(temporary, target);
        } finally { await rm(temporary, { force: true }); }
      }
    } finally { await unlock(); }
  }
  for (const callback of mutation.committed) {
    try { callback(); } catch { console.warn("WAREHOUSE_AFTER_COMMIT_FAILED"); }
  }
  return result;
}
