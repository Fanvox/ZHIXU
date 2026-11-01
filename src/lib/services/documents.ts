// 文档处理流水线 —— 保存文件 → 解析 → 分块 → 知识抽取。
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { run } from "../db/driver";
import { getDocument, updateDocumentStatus, addChunks, deleteChunks, deleteDocument } from "../db/repo";
import { parseDocument } from "../parser";
import { extractAndSave, type ExtractionResult } from "./knowledge";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

function extOf(filename: string, mime: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext && ext.length <= 5) return ext;
  const m = mime.split("/")[1] ?? "bin";
  return m === "plain" ? "txt" : m === "markdown" ? "md" : m;
}

/** 保存上传文件到本地磁盘，并记录 storage_path。 */
export async function storeUpload(
  documentId: string,
  filename: string,
  mime: string,
  data: Uint8Array
): Promise<string> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = extOf(filename, mime);
  const rel = path.join("data", "uploads", `${documentId}.${ext}`).replace(/\\/g, "/");
  const abs = path.join(process.cwd(), rel);
  await writeFile(abs, data);
  run("UPDATE documents SET storage_path = ?, updated_at = ? WHERE id = ?", [rel, new Date().toISOString(), documentId]);
  return rel;
}

/** 解析并抽取知识。status 流转：parsing → extracting → completed/failed。 */
export async function processDocument(documentId: string, userId: string): Promise<ExtractionResult> {
  const doc = getDocument(documentId);
  if (!doc) throw new Error("文档不存在");
  updateDocumentStatus(documentId, "parsing");
  try {
    const rel = doc.storage_path ?? path.join("data", "uploads", `${documentId}.${extOf(doc.filename, doc.mime_type)}`);
    const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    const data = new Uint8Array(await readFile(abs));
    const result = await parseDocument(data, doc.mime_type, doc.filename);
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

    const extraction = await extractAndSave(doc.course_id, documentId, userId);
    updateDocumentStatus(documentId, "completed", {
      chunk_count: result.chunks.length,
      parse_error: null,
    });
    return extraction;
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
    const abs = path.isAbsolute(doc.storage_path) ? doc.storage_path : path.join(process.cwd(), doc.storage_path);
    try {
      await unlink(abs);
    } catch {
      // 文件不存在则忽略
    }
  }
  deleteDocument(documentId);
}
