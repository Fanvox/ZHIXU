// 知识抽取编排 —— 优先使用大模型结构化输出，未配置 Key 时降级到演示规则引擎。
// 大文档采用「分批提取 + 去重合并」，避免只看到文档开头。
import { isAIEnabled, chatCompletionJSON, aiConfig } from "../ai/provider";
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
import type { KnowledgeNode, KnowledgeEdge, RelationType } from "../types";

export interface ExtractionResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  mode: "ai" | "demo";
  demo: boolean;
}

const SYSTEM_PROMPT =
  "你是知序学习平台的知识提取引擎。请从课程资料中提取核心知识点及其关系。只依据资料内容，不要加入资料中未明确表达的常识性推断；无法确定的关系不要臆造。输出 JSON。";

// 分批提取参数
const BATCH_SIZE = 15; // 每批分块数
const MAX_BATCHES = 12; // 最多处理的批次数（限制 API 调用次数）
const CHUNK_CAP = 800; // 单个分块最多喂给模型的字符数

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** 把模型输出的关系类型（可能是中文描述）归一化到标准枚举。 */
function normalizeRelationType(rt: string): RelationType {
  const s = rt.trim().toLowerCase();
  if (/(prereq|前置|先修|基础|依赖|需先|precede|是.*基础)/.test(s)) return "prerequisite";
  if (/(contain|包含|属于|组成|部分|subpart|part.?of)/.test(s)) return "contains";
  if (/(example|实例|举例|例子|例如)/.test(s)) return "example_of";
  return "related";
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
  const idByName = new Map<string, string>();
  for (const n of existing) idByName.set(normalizeName(n.name), n.id);

  const created: KnowledgeNode[] = [];
  const nodeInputs = extraction.nodes.slice(0, 200);
  for (const n of nodeInputs) {
    const key = normalizeName(n.name);
    if (!key || idByName.has(key)) continue; // 去重
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
  for (const e of extraction.edges.slice(0, 400)) {
    const s = idByName.get(normalizeName(e.source));
    const t = idByName.get(normalizeName(e.target));
    if (!s || !t || s === t) continue;
    const dedupKey = `${s}|${t}|${e.relation_type}`;
    if (existingEdges.has(dedupKey)) continue;
    const edge = createEdge({
      course_id: courseId,
      source_node_id: s,
      target_node_id: t,
      relation_type: normalizeRelationType(e.relation_type),
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
    const result = await extractWithLLMBatches(chunks, userId);
    if (result) return { ...result, demo: false };
    // 大模型失败时降级演示引擎
  }
  return { ...demoExtractKnowledge(chunks), demo: true };
}

/** 分批调用大模型抽取，并把结果去重合并。 */
async function extractWithLLMBatches(
  chunks: { content: string; page_start: number | null; section: string | null }[],
  userId: string
): Promise<KnowledgeExtraction | null> {
  const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
  const indices = sampleIndices(totalBatches, MAX_BATCHES);
  const model = aiConfig(userId).extractModel; // 抽取使用独立模型（可用快速模型）

  const allNodes: KnowledgeExtraction["nodes"] = [];
  const allEdges: KnowledgeExtraction["edges"] = [];

  for (const bi of indices) {
    const batch = chunks.slice(bi * BATCH_SIZE, (bi + 1) * BATCH_SIZE);
    const prompt = buildExtractionPrompt(batch);
    const result = await chatCompletionJSON(
      userId,
      KnowledgeExtractionSchema,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { model }
    );
    if (result) {
      allNodes.push(...result.nodes);
      allEdges.push(...result.edges);
    }
  }

  if (allNodes.length === 0) return null;

  // 跨批按名称去重
  const seen = new Set<string>();
  const nodes: KnowledgeExtraction["nodes"] = [];
  for (const n of allNodes) {
    const key = n.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    nodes.push(n);
  }

  return { nodes, edges: allEdges };
}

/** 从 [0, total-1] 中取不超过 max 个索引，尽量分散覆盖全文。 */
function sampleIndices(total: number, max: number): number[] {
  if (total <= max) return Array.from({ length: total }, (_, i) => i);
  const result: number[] = [];
  for (let i = 0; i < max; i++) {
    result.push(Math.floor((i * total) / max));
  }
  return result;
}

function buildExtractionPrompt(
  chunks: { content: string; page_start: number | null; section: string | null }[]
): string {
  const lines: string[] = ["以下是课程资料的文本分块（含页码/章节标注）："];
  for (const c of chunks) {
    const tag = [c.section, c.page_start != null ? `第${c.page_start}页` : null]
      .filter(Boolean)
      .join(" · ");
    lines.push(`\n【${tag || "未标注"}】\n${c.content.slice(0, CHUNK_CAP)}`);
  }
  lines.push(
    "\n请提取知识点（nodes）与关系（edges）。要求：\n" +
      "- nodes: name（简短名词）、definition（定义）、detail（详细解释）、chapter、difficulty(1-5)、source_page\n" +
      "- edges: source/target 使用节点 name；relation_type 只能是 prerequisite(前置)/related(相关)/contains(包含)/example_of(实例) 之一（请写英文枚举值）；evidence 为一句依据\n" +
      "- 仅提取资料明确表达的内容，不确定的关系标记较低 confidence"
  );
  return lines.join("\n");
}
