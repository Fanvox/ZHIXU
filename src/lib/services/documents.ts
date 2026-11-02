// 文档处理流水线 —— 保存文件 → 解析 → 分块 → 知识抽取。
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { run } from "../db/driver";
import { getDocument, updateDocumentStatus, addChunks, deleteChunks, deleteDocument } from "../db/repo";
import { parseDocument } from "../parser";
import { extractAndSave, type ExtractionResult } from "./knowledge";
import { UPLOAD_DIR, resolveStoragePath } from "../paths";

function extOf(filename: string, mime: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ext.length <= 5) return ext;
  const m = mime.split("/")[1] ?? "bin";
  return m === "plain" ? "txt" : m === "markdown" ? "md" : m;
}

/**
 * 保存上传文件到磁盘，并记录 storage_path。
 * 使用流式写入，避免把大文件整体读进内存（峰值内存显著降低）。
 * storage_path 存储的是「相对 DATA_DIR 的路径」（如 uploads/xxx.pdf），
 * 这样容器挂载持久卷后路径依然有效。
 */
export async function storeUpload(
  documentId: string,
  filename: string,
  mime: string,
  stream: ReadableStream<Uint8Array> | Uint8Array
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extOf(filename, mime);
  const rel = `uploads/${documentId}.${ext}`;
  const abs = path.join(UPLOAD_DIR, `${documentId}.${ext}`);
  try {
    if (stream instanceof Uint8Array) {
      await writeFile(abs, stream);
    } else {
      const nodeReadable = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
      await pipeline(nodeReadable, createWriteStream(abs));
    }
  } catch (err) {
    // 写入失败时清理可能产生的半成品文件
    try {
      await unlink(abs);
    } catch {
      /* 忽略 */
    }
    throw err;
  }
  run("UPDATE documents SET storage_path = ?, updated_at = ? WHERE id = ?", [
    rel,
    new Date().toISOString(),
    documentId,
  ]);
  return rel;
}

/**
 * 检测「文本量过少」的情况（扫描版 / 图片型 PDF、纯图片 PPT 等），
 * 返回给用户的提示；正常则返回 null。
 */
function detectLowTextWarning(pageCount: number | null, chunkCount: number, charCount: number): string | null {
  if (chunkCount === 0) {
    return "未能提取到任何文本：该文件可能是扫描版/图片型，建议改用带文本层的 PDF 或原文档";
  }
  const pages = pageCount ?? 0;
  if (pages >= 5 && charCount / pages < 50) {
    return `疑似扫描版/图片型文件：共 ${pages} 页但仅提取到 ${charCount} 个字符，知识图谱可能不完整。建议改用带文本层的文件`;
  }
  return null;
}

/** 解析并抽取知识。status 流转：parsing → extracting → completed/failed。 */
export async function processDocument(documentId: string, userId: string): Promise<ExtractionResult> {
  const doc = getDocument(documentId);
  if (!doc) throw new Error("文档不存在");
  // 开始处理时清空上次的错误 / 警告，避免重试成功后界面仍显示旧信息
  updateDocumentStatus(documentId, "parsing", { parse_error: null });
  try {
    const rel = doc.storage_path ?? `uploads/${documentId}.${extOf(doc.filename, doc.mime_type)}`;
    const abs = resolveStoragePath(rel);
    const data = new Uint8Array(await readFile(abs));
    const result = await parseDocument(data, doc.mime_type, doc.filename);

    // 解析耗时可能较长，期间文档/课程可能已被删除，避免后续写入触发外键错误
    if (!getDocument(documentId)) {
      throw new Error("文档在处理过程中已被删除，已跳过");
    }

    updateDocumentStatus(documentId, "extracting", { page_count: result.page_count ?? undefined });

    // 重新处理时先清掉旧分块，避免重复
    deleteChunks(documentId);
    addChunks(
      documentId,
      result.chunks.map((c) => ({
        content: c.content,
        page_start: c.page_start,
        page_end: c.page_end,
        section: c.section,
      }))
    );

    const charCount = result.chunks.reduce((sum, c) => sum + c.content.length, 0);
    const lowText = detectLowTextWarning(result.page_count, result.chunks.length, charCount);

    const extraction = await extractAndSave(doc.course_id, documentId, userId);
    const warnings = [extraction.warning, lowText].filter((w): w is string => !!w);

    updateDocumentStatus(documentId, "completed", {
      chunk_count: result.chunks.length,
      // 非致命提示（AI 降级、文本过少等）写入 parse_error 字段，界面以警告色展示
      parse_error: warnings.length ? warnings.join("；") : null,
    });
    return { ...extraction, warning: warnings.length ? warnings.join("；") : null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateDocumentStatus(documentId, "failed", { parse_error: msg });
    throw err;
  }
}

/** 删除文档记录及其磁盘文件。 */
export async function removeDocument(documentId: string): Promise<void> {
  const doc = getDocument(documentId);
  if (doc?.storage_path) {
    const abs = resolveStoragePath(doc.storage_path);
    try {
      await unlink(abs);
    } catch {
      // 文件不存在则忽略
    }
  }
  deleteDocument(documentId);
}
