// SQLite driver wrapper — uses Node 24 built-in `node:sqlite` (zero native deps).
// In production this same schema maps 1:1 to the Supabase/PostgreSQL migrations
// under /supabase/migrations.
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "zhixu.db");

declare global {
  var __zhixuDb: DatabaseSync | undefined;
}

export function getDb(): DatabaseSync {
  if (globalThis.__zhixuDb) return globalThis.__zhixuDb;
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  globalThis.__zhixuDb = db;
  return db;
}

/** 执行多语句迁移/建表。 */
export function exec(sql: string): void {
  getDb().exec(sql);
}

/** 查询多行。params 使用 ? 占位符或 $name。 */
export function all<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T[] {
  const stmt = getDb().prepare(sql);
  return stmt.all(...(params as SQLInputValue[])) as unknown as T[];
}

/** 查询单行。 */
export function get<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): T | undefined {
  const stmt = getDb().prepare(sql);
  return stmt.get(...(params as SQLInputValue[])) as unknown as T | undefined;
}

/** 执行写操作，返回 lastInsertRowid。 */
export function run(sql: string, params: unknown[] = []): number {
  const stmt = getDb().prepare(sql);
  const res = stmt.run(...(params as SQLInputValue[]));
  return Number(res.lastInsertRowid);
}

export function now(): string {
  return new Date().toISOString();
}
