// AI 结构化输出 Schema（zod），用于校验模型返回值。
//
// 容错原则（重要）：模型输出经常不规范——数字写成字符串、置信度写成 "high"、
// 题型写成中文。这里逐字段做宽松归一化，并且**单条节点/边校验失败只丢弃该条**，
// 不会让整批结果作废（此前一个 `confidence: null` 就会废掉整个批次）。
import { z } from "zod";

/** 把任意输入尽力转成数字；无法解析返回 undefined（视作「未提供」）。 */
function toNumber(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const m = v.match(/-?\d+(?:\.\d+)?/);
    if (!m) return undefined;
    const n = Number(m[0]);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const coerceDifficulty = z.preprocess(
  (v) => {
    const n = toNumber(v);
    if (n === undefined) return undefined;
    return Math.min(5, Math.max(1, Math.round(n)));
  },
  z.number().int().min(1).max(5).optional()
);

const coercePage = z.preprocess(
  (v) => {
    const n = toNumber(v);
    if (n === undefined) return undefined;
    const i = Math.round(n);
    return i > 0 ? i : undefined;
  },
  z.number().int().positive().optional()
);

const coerceConfidence = z.preprocess(
  (v) => {
    const n = toNumber(v);
    if (n === undefined) return undefined;
    // 兼容 0~1 与 0~100（百分比）两种写法
    const normalized = n > 1 ? n / 100 : n;
    return Math.min(1, Math.max(0, normalized));
  },
  z.number().min(0).max(1).optional()
);

export const ExtractedNodeSchema = z.object({
  name: z.string().min(1).max(120),
  definition: z.string().max(2000).optional(),
  detail: z.string().max(8000).optional(),
  chapter: z.string().max(200).optional(),
  difficulty: coerceDifficulty.optional(),
  source_page: coercePage.optional(),
});

export const ExtractedEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  // 关系类型放宽为字符串，稍后由代码统一归一化到枚举（模型常输出中文描述）
  relation_type: z.string().min(1),
  evidence: z.string().max(500).optional(),
  confidence: coerceConfidence.optional(),
});

/** 单条校验失败时降级为 null，稍后过滤掉，避免整批作废。 */
const TolerantNode = z.unknown().transform((v): ExtractedNode | null => {
  const r = ExtractedNodeSchema.safeParse(v);
  return r.success ? r.data : null;
});
const TolerantEdge = z.unknown().transform((v): ExtractedEdge | null => {
  const r = ExtractedEdgeSchema.safeParse(v);
  return r.success ? r.data : null;
});

export const KnowledgeExtractionSchema = z.object({
  nodes: z
    .array(TolerantNode)
    .max(80)
    .transform((arr) => arr.filter((n): n is ExtractedNode => n !== null)),
  edges: z
    .array(TolerantEdge)
    .max(160)
    .transform((arr) => arr.filter((e): e is ExtractedEdge => e !== null)),
});

/** 把模型可能输出的中文题型归一化到标准枚举。 */
function normalizeQuizType(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  if (/multiple|多选/.test(s)) return "multiple";
  if (/single|单选|选择/.test(s)) return "single";
  if (/true_?false|judge|判断/.test(s)) return "true_false";
  if (/short|answer|简答|问答|填空/.test(s)) return "short_answer";
  if (/code|编程|代码/.test(s)) return "code";
  return s;
}

export const QuizQuestionSchema = z.object({
  type: z.preprocess(
    normalizeQuizType,
    z.enum(["single", "multiple", "true_false", "short_answer", "code"])
  ),
  stem: z.string().min(1).max(2000),
  options: z.array(z.string()).max(8).default([]),
  answer: z.string().min(1).max(500),
  explanation: z.string().max(3000).default(""),
  node_id: z.string().optional(),
  difficulty: coerceDifficulty.optional(),
});

const TolerantQuestion = z.unknown().transform((v): QuizQuestion | null => {
  const r = QuizQuestionSchema.safeParse(v);
  return r.success ? r.data : null;
});

export const QuizGenerationSchema = z.object({
  questions: z
    .array(TolerantQuestion)
    .max(30)
    .transform((arr) => arr.filter((q): q is QuizQuestion => q !== null)),
});

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;
export type ExtractedEdge = z.infer<typeof ExtractedEdgeSchema>;
export type KnowledgeExtraction = z.infer<typeof KnowledgeExtractionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizGeneration = z.infer<typeof QuizGenerationSchema>;
