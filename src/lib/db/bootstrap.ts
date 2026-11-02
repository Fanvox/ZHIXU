// 数据库引导 —— 首次访问时自动建表并写入演示数据（幂等）。
import { seedIfEmpty } from "./seed";
import { recoverInterruptedJobs } from "../services/jobs";

let seeded = false;

export function ensureSeeded(): void {
  if (seeded) return;
  seedIfEmpty();
  seeded = true;
  // 恢复上次进程中断时未完成的文档处理任务
  recoverInterruptedJobs();
}
