// 文档处理后台队列。
// 上传接口立即返回，实际「解析 → 分块 → 知识抽取」在后台执行，
// 避免长文档处理（可能十几分钟）阻塞 HTTP 请求导致网关/浏览器超时。
//
// 可靠性设计：
// - **并发处理**（默认 2，`DOC_CONCURRENCY` 可配）：一个用户的超大文件不会阻塞其他人
// - 单文档处理超时（默认 30 分钟）：超时标记失败并释放并发槽位，避免队列永久卡死
// - 看门狗（每分钟）：清理长时间无进展的中间状态文档
// - 启动恢复：进程重启后重新入队 pending / parsing / extracting 的文档
// - 队列快照：接口层可读取「正在处理/排队中」，前端据此展示排队位置
import { getDocument, listInterruptedDocuments, listStaleDocuments, updateDocumentStatus } from "../db/repo";
import { processDocument } from "./documents";

interface Job {
  documentId: string;
  userId: string;
}

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 同时处理的文档数上限（默认 2） */
const MAX_CONCURRENT = intEnv("DOC_CONCURRENCY", 2);
/** 单文档处理超时（毫秒），默认 30 分钟 */
const JOB_TIMEOUT_MS = intEnv("DOC_PROCESS_TIMEOUT_MS", 30 * 60_000);
/** 看门狗判定「长时间无进展」的阈值：在处理超时之上再留 10 分钟余量 */
const WATCHDOG_STALE_MS = JOB_TIMEOUT_MS + 10 * 60_000;

const queue: Job[] = [];
const active = new Set<string>();
const processing = new Set<string>();
let recovered = false;
let watchdogStarted = false;

/** 队列快照，供接口层/前端展示排队位置。 */
export function getQueueSnapshot(): { processing: string[]; queued: string[] } {
  return { processing: [...processing], queued: queue.map((j) => j.documentId) };
}

/** 给 Promise 加超时（超时后原任务无法强制中止，但会标记失败并释放槽位）。 */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** 把文档加入后台处理队列（同一文档去重）。 */
export function enqueueDocument(documentId: string, userId: string): void {
  if (active.has(documentId)) return;
  active.add(documentId);
  queue.push({ documentId, userId });
  pump();
}

/** 尽量填满并发槽位。 */
function pump(): void {
  while (processing.size < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    processing.add(job.documentId);
    void runJob(job).finally(() => {
      processing.delete(job.documentId);
      active.delete(job.documentId);
      // 释放槽位后继续取下一个
      pump();
    });
  }
}

async function runJob(job: Job): Promise<void> {
  try {
    // 文档可能在排队期间被删除
    if (!getDocument(job.documentId)) return;
    await withTimeout(
      processDocument(job.documentId, job.userId),
      JOB_TIMEOUT_MS,
      `文档处理超时（超过 ${Math.round(JOB_TIMEOUT_MS / 60_000)} 分钟），已中止。请检查文件是否过大或格式异常后重试`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("已被删除")) {
      console.log("[jobs] 跳过已删除的文档:", job.documentId);
      return;
    }
    console.error("[jobs] 文档处理失败:", job.documentId, msg);
    try {
      // 确保文档不会永远停留在中间状态（超时场景 processDocument 仍在后台运行）
      const doc = getDocument(job.documentId);
      if (doc && (doc.status === "pending" || doc.status === "parsing" || doc.status === "extracting")) {
        updateDocumentStatus(job.documentId, "failed", { parse_error: msg });
      }
    } catch {
      /* 忽略写入失败 */
    }
  }
}

/** 服务启动后恢复上次中断的任务（每个进程只执行一次）。 */
export function recoverInterruptedJobs(): void {
  if (recovered) return;
  recovered = true;
  try {
    const rows = listInterruptedDocuments();
    for (const row of rows) enqueueDocument(row.id, row.user_id);
    if (rows.length) console.log(`[jobs] 恢复未完成任务 ${rows.length} 个`);
  } catch (err) {
    console.error("[jobs] 恢复中断任务失败:", err);
  }
}

/** 启动看门狗：清理长时间停留在中间状态的文档（每个进程只执行一次）。 */
export function startJobWatchdog(): void {
  if (watchdogStarted) return;
  watchdogStarted = true;
  const timer = setInterval(() => {
    try {
      for (const row of listStaleDocuments(WATCHDOG_STALE_MS)) {
        if (active.has(row.id)) continue; // 本进程正在处理，跳过
        updateDocumentStatus(row.id, "failed", {
          parse_error: `处理长时间无进展（超过 ${Math.round(WATCHDOG_STALE_MS / 60_000)} 分钟），已自动标记失败，可重新处理`,
        });
        console.error("[jobs] 看门狗：标记超时文档", row.id);
      }
    } catch (err) {
      console.error("[jobs] 看门狗检查失败:", err);
    }
  }, 60_000);
  const maybeUnref = timer as unknown as { unref?: () => void };
  if (typeof maybeUnref.unref === "function") maybeUnref.unref();
}
