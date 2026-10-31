// 检索服务 —— 初期使用关键词检索（BM25 风格的词频打分），
// 部署到 Supabase + pgvector 后可无缝升级为向量检索。
import { all } from "../db/driver";

export interface RetrievalHit {
  chunk_id: string;
  document_id: string;
  document_name: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
  score: number;
}

function tokenize(text: string): string[] {
  const cjk = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const ascii = (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((w) => w.length >= 2);
  return [...cjk, ...ascii];
}

export function searchChunks(courseId: string, query: string, limit = 4): RetrievalHit[] {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];

  const rows = all<Record<string, unknown>>(
    `SELECT dc.id AS chunkId, dc.document_id AS documentId, d.filename AS documentName,
      dc.content, dc.page_start AS pageStart, dc.page_end AS pageEnd, dc.section
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE d.course_id = ?`,
    [courseId]
  );

  const hits = rows
    .map((r) => {
      const content = String(r.content);
      const tokens = tokenize(content);
      const hit = tokens.filter((t) => qTokens.has(t)).length;
      const score = tokens.length === 0 ? 0 : hit / Math.sqrt(tokens.length);
      return {
        chunk_id: String(r.chunkId),
        document_id: String(r.documentId),
        document_name: String(r.documentName),
        content,
        page_start: r.pageStart == null ? null : Number(r.pageStart),
        page_end: r.pageEnd == null ? null : Number(r.pageEnd),
        section: r.section == null ? null : String(r.section),
        score,
      } as RetrievalHit;
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return hits;
}

/** 匹配与查询相关的知识节点 ID。 */
export function matchNodes(courseId: string, query: string, limit = 4): string[] {
  const qTokens = new Set(tokenize(query));
  if (qTokens.size === 0) return [];
  const rows = all<{ id: string; name: string; definition: string | null }>(
    "SELECT id, name, definition FROM knowledge_nodes WHERE course_id = ?",
    [courseId]
  );
  return rows
    .map((r) => {
      const tokens = tokenize(`${r.name} ${r.definition ?? ""}`);
      const hit = tokens.filter((t) => qTokens.has(t)).length;
      const exact = qTokens.has(r.name.toLowerCase());
      return { id: r.id, score: hit + (exact ? 2 : 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.id);
}
