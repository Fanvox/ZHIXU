// 文档处理后台队列。
// 上传接口立即返回，实际「解析 → 分块 → 知识抽取」在后台按顺序执行，
// 避免长文档处理（可能 1~3 分钟）阻塞 HTTP 请求导致网关/浏览器超时。
// 进程重启后会自动恢复上次中断的任务（status 停留在 pending/parsing/extracting 的文档）。
import { getDocument, listInterruptedDocuments } from "../db/repo";
import { processDocument } from "./documents";

interface Job {
  documentId: string;
  userId: string;
}

const queue: Job[] = [];
const active = new Set<string>();
let draining = false;
let recovered = false;

/** 把文档加入后台处理队列（同一文档去重）。 */
export function enqueueDocument(documentId: string, userId: string): void {
  if (active.has(documentId)) return;
  active.add(documentId);
  queue.push({ documentId, userId });
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (queue.length > 0) {
      const job = queue.shift()!;
      try {
        // 文档可能在排队期间被删除
        if (getDocument(job.documentId)) {
          await processDocument(job.documentId, job.userId);
        }
      } catch (err) {
        // processDocument 内部已把文档标记为 failed，这里只记录日志
        console.error("[jobs] 文档处理失败:", job.documentId, err);
      } finally {
        active.delete(job.documentId);
      }
    }
  } finally {
    draining = false;
  }
}

/** 服务启动后恢复上次中断的任务（每个进程只执行一次）。 */
export function recoverInterruptedJobs(): void {
  if (recovered) return;
  recovered = true;
  try {
    for (const row of listInterruptedDocuments()) enqueueDocument(row.id, row.user_id);
  } catch (err) {
    console.error("[jobs] 恢复中断任务失败:", err);
  }
}
