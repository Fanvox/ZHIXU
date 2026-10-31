// 数据库引导 —— 首次访问时自动建表并写入演示数据（幂等）。
import { seedIfEmpty } from "./seed";

let seeded = false;

export function ensureSeeded(): void {
  if (seeded) return;
  seedIfEmpty();
  seeded = true;
}
