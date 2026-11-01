// AI 结构化输出 Schema（zod），用于校验模型返回值。
// 数字字段做容错转换（模型常把数字输出为字符串，如 "10" 或 "第10页"）。
import { z } from "zod";

const coerceDifficulty = z.preprocess((v) => {
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    return m ? Number(m[0]) : NaN;
  }
  return v;
}, z.number().int().min(1).max(5));

const coercePage = z.preprocess((v) => {
  if (typeof v === "string") {
    const m = v.match(/\d+/);
    return m ? Number(m[0]) : NaN;
  }
  return v;
}, z.number().int().positive());

const coerceConfidence = z.preprocess((v) => {
  if (typeof v === "string") {
    const m = v.match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : NaN;
  }
  return v;
}, z.number().min(0).max(1));

export const ExtractedNodeSchema = z.object({
  name: z.string().min(1).max(120),
  definition: z.string().min(1).max(2000).optional(),
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

export const KnowledgeExtractionSchema = z.object({
  nodes: z.array(ExtractedNodeSchema).max(60),
  edges: z.array(ExtractedEdgeSchema).max(120),
});

export const QuizQuestionSchema = z.object({
  type: z.enum(["single", "multiple", "true_false", "short_answer", "code"]),
  stem: z.string().min(1).max(2000),
  options: z.array(z.string()).max(8).default([]),
  answer: z.string().min(1).max(500),
  explanation: z.string().max(3000).default(""),
  node_id: z.string().optional(),
  difficulty: coerceDifficulty.optional(),
});

export const QuizGenerationSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1).max(20),
});

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;
export type ExtractedEdge = z.infer<typeof ExtractedEdgeSchema>;
export type KnowledgeExtraction = z.infer<typeof KnowledgeExtractionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizGeneration = z.infer<typeof QuizGenerationSchema>;
