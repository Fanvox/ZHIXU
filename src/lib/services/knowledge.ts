// 知识抽取编排 —— 优先使用大模型结构化输出，未配置 Key 时降级到演示规则引擎。
import { isAIEnabled, chatCompletionJSON } from "../ai/provider";
import { KnowledgeExtractionSchema, type KnowledgeExtraction } from "../ai/schemas";
import { demoExtractKnowledge } from "../ai/demo";
import {
  listChunks,
  listNodes,
  createNode,
  createEdge,
  listEdges,
  updateDocumentStatus,
} from "../db/repo";
import type { KnowledgeNode, KnowledgeEdge } from "../types";

export interface ExtractionResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  mode: "ai" | "demo";
  demo: boolean;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export async function extractAndSave(
  courseId: string,
  documentId: string,
  userId: string
): Promise<ExtractionResult> {
  const chunks = listChunks(documentId);
  if (chunks.length === 0) {
    updateDocumentStatus(documentId, "failed", { parse_error: "文档没有可解析的文本内容" });
    return { nodes: [], edges: [], mode: "demo", demo: true };
  }

  const extraction = await runExtraction(chunks, userId);

  // 去重 + 落库
  const existing = listNodes(courseId);
  const existingByName = new Map<string, KnowledgeNode>();
  for (const n of existing) existingByName.set(normalizeName(n.name), n);

  const created: KnowledgeNode[] = [];
  const idByName = new Map<string, string>();
  for (const n of existing) idByName.set(normalizeName(n.name), n.id);

  const nodeInputs = extraction.nodes.slice(0, 60);
  for (const n of nodeInputs) {
    const key = normalizeName(n.name);
    if (idByName.has(key)) continue; // 去重
    const node = createNode({
      course_id: courseId,
      name: n.name.trim(),
      definition: n.definition ?? null,
      detail: n.detail ?? null,
      chapter: n.chapter ?? null,
      difficulty: (n.difficulty ?? 3) as KnowledgeNode["difficulty"],
      source_document_id: documentId,
      source_page: n.source_page ?? null,
      confidence: extraction.demo ? 0.45 : 0.7,
      verified: false, // 所有 AI/规则产出均默认待人工确认
    });
    created.push(node);
    idByName.set(key, node.id);
  }

  const existingEdges = new Set(
    listEdges(courseId).map((e) => `${e.source_node_id}|${e.target_node_id}|${e.relation_type}`)
  );
  const edges: KnowledgeEdge[] = [];
  for (const e of extraction.edges.slice(0, 120)) {
    const s = idByName.get(normalizeName(e.source));
    const t = idByName.get(normalizeName(e.target));
    if (!s || !t || s === t) continue;
    const dedupKey = `${s}|${t}|${e.relation_type}`;
    if (existingEdges.has(dedupKey)) continue;
    const edge = createEdge({
      course_id: courseId,
      source_node_id: s,
      target_node_id: t,
      relation_type: e.relation_type,
      evidence: e.evidence ?? null,
      confidence: e.confidence ?? (extraction.demo ? 0.4 : 0.6),
      verified: false,
    });
    edges.push(edge);
    existingEdges.add(dedupKey);
  }

  updateDocumentStatus(documentId, "completed", {
    chunk_count: chunks.length,
  });

  return {
    nodes: [...created],
    edges,
    mode: extraction.demo ? "demo" : "ai",
    demo: extraction.demo,
  };
}

async function runExtraction(
  chunks: { content: string; page_start: number | null; section: string | null }[],
  userId: string
): Promise<KnowledgeExtraction & { demo: boolean }> {
  if (isAIEnabled(userId)) {
    const prompt = buildExtractionPrompt(chunks);
    const result = await chatCompletionJSON(userId, KnowledgeExtractionSchema, [
      {
        role: "system",
        content:
          "你是知序学习平台的知识提取引擎。请从课程资料中提取核心知识点及其关系。只依据资料内容，不要加入资料中未明确表达的常识性推断；无法确定的关系不要臆造。输出 JSON。",
      },
      { role: "user", content: prompt },
    ]);
    if (result) return { ...result, demo: false };
    // 大模型失败时降级演示引擎
  }
  return { ...demoExtractKnowledge(chunks), demo: true };
}

function buildExtractionPrompt(
  chunks: { content: string; page_start: number | null; section: string | null }[]
): string {
  const lines: string[] = ["以下是课程资料的文本分块（含页码/章节标注）："];
  let total = 0;
  const maxChars = 16000;
  for (const c of chunks.slice(0, 60)) {
    if (total > maxChars) break;
    const tag = [c.section, c.page_start != null ? `第${c.page_start}页` : null]
      .filter(Boolean)
      .join(" · ");
    lines.push(`\n【${tag || "未标注"}】\n${c.content.slice(0, 2000)}`);
    total += c.content.length;
  }
  lines.push(
    "\n请提取知识点（nodes）与关系（edges）。要求：\n" +
      "- nodes: name（简短名词）、definition（定义）、detail（详细解释）、chapter、difficulty(1-5)、source_page\n" +
      "- edges: source/target 使用节点 name；relation_type 取 prerequisite/related/contains/example_of；evidence 为一句依据\n" +
      "- 仅提取资料明确表达的内容，不确定的关系标记较低 confidence"
  );
  return lines.join("\n");
}
