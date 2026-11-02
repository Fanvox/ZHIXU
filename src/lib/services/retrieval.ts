// 检索服务 —— 阶段 0：中文 bigram 分词 + BM25。
// 说明：中文按「二元组」切分，可显著改善「内存分配 / 分配内存」这类字面不重合的匹配；
// 英文按单词（长度 >= 2）。部署到 Supabase + pgvector 后可在此基础上叠加向量检索。
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

/** BM25 参数 */
const K1 = 1.2;
const B = 0.75;

/**
 * 分词：英文按单词，中文按二元组（bigram）。
 * 例：「动态内存分配」→ 动态 / 态内 / 内存 / 存分 / 分配
 */
function tokenize(text: string): string[] {
  const tokens: string[] = [];

  const ascii = text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
  for (const w of ascii) if (w.length >= 2) tokens.push(w);

  const cjkRuns = text.match(/[\u4e00-\u9fff]+/g) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      tokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) tokens.push(run.slice(i, i + 2));
  }

  return tokens;
}

/** BM25 打分（tf 只保留与查询词相关的词频，节省内存） */
function bm25(
  tf: Map<string, number>,
  len: number,
  avgdl: number,
  df: Map<string, number>,
  docCount: number,
  qTerms: string[]
): number {
  let score = 0;
  for (const q of qTerms) {
    const f = tf.get(q) ?? 0;
    if (f === 0) continue;
    const dfq = df.get(q) ?? 0;
    // 加 0.5 平滑，避免负值；dfq 为 0 时理论上不会走到这里
    const idf = Math.log(1 + (docCount - dfq + 0.5) / (dfq + 0.5));
    const norm = 1 - B + B * (len / (avgdl || 1));
    score += (idf * (f * (K1 + 1))) / (f + K1 * norm);
  }
  return score;
}

export function searchChunks(courseId: string, query: string, limit = 4): RetrievalHit[] {
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0) return [];
  const qSet = new Set(qTerms);

  const rows = all<Record<string, unknown>>(
    `SELECT dc.id AS chunkId, dc.document_id AS documentId, d.filename AS documentName,
      dc.content, dc.page_start AS pageStart, dc.page_end AS pageEnd, dc.section
     FROM document_chunks dc
     JOIN documents d ON d.id = dc.document_id
     WHERE d.course_id = ?`,
    [courseId]
  );
  if (rows.length === 0) return [];

  // 一次遍历：分词 + 只保留查询词词频 + 统计文档长度
  const docs = rows.map((r) => {
    const content = String(r.content);
    const tokens = tokenize(content);
    const tf = new Map<string, number>();
    for (const t of tokens) if (qSet.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { row: r, content, tf, len: tokens.length };
  });

  const docCount = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / docCount;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  return docs
    .map((d) => ({ d, score: bm25(d.tf, d.len, avgdl, df, docCount, qTerms) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ d, score }) => ({
      chunk_id: String(d.row.chunkId),
      document_id: String(d.row.documentId),
      document_name: String(d.row.documentName),
      content: d.content,
      page_start: d.row.pageStart == null ? null : Number(d.row.pageStart),
      page_end: d.row.pageEnd == null ? null : Number(d.row.pageEnd),
      section: d.row.section == null ? null : String(d.row.section),
      score,
    }));
}

/** 匹配与查询相关的知识节点 ID。 */
export function matchNodes(courseId: string, query: string, limit = 4): string[] {
  const qTerms = [...new Set(tokenize(query))];
  if (qTerms.length === 0) return [];
  const qSet = new Set(qTerms);

  const rows = all<{ id: string; name: string; definition: string | null }>(
    "SELECT id, name, definition FROM knowledge_nodes WHERE course_id = ?",
    [courseId]
  );
  if (rows.length === 0) return [];

  const docs = rows.map((r) => {
    const nameTokens = tokenize(r.name);
    const defTokens = tokenize(r.definition ?? "");
    const tf = new Map<string, number>();
    for (const t of [...nameTokens, ...defTokens]) {
      if (qSet.has(t)) tf.set(t, (tf.get(t) ?? 0) + 1);
    }
    const nameHits = nameTokens.filter((t) => qSet.has(t)).length;
    return { row: r, tf, len: nameTokens.length + defTokens.length, nameHits };
  });

  const docCount = docs.length;
  const avgdl = docs.reduce((s, d) => s + d.len, 0) / docCount;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);

  return docs
    .map((d) => ({
      id: d.row.id,
      // 名称命中额外加权：知识点名称比定义更能代表主题
      score: bm25(d.tf, d.len, avgdl, df, docCount, qTerms) + d.nameHits * 1.5,
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.id);
}
