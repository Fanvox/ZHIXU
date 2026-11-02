// 统一的数据路径定义。
// 本地开发默认 ./data；生产环境（容器 / 托管平台）通过 DATA_DIR 指向持久卷，
// 这样数据库与上传文件在容器重启后依然保留。
import path from "node:path";
import { existsSync } from "node:fs";

/** 数据根目录 */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

/** SQLite 数据库文件 */
export const DB_PATH = path.join(DATA_DIR, "zhixu.db");

/** 上传文件目录 */
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

/**
 * 把 documents.storage_path 解析为绝对路径。
 * 新格式：相对 DATA_DIR（如 `uploads/xxx.pdf`）。
 * 旧格式：`data/uploads/xxx.pdf`（相对项目根），用于兼容历史数据。
 */
export function resolveStoragePath(storagePath: string): string {
  if (path.isAbsolute(storagePath)) return storagePath;
  const fromDataDir = path.join(DATA_DIR, storagePath);
  if (existsSync(fromDataDir)) return fromDataDir;
  return path.join(process.cwd(), storagePath);
}
