// AI 结构化输出 Schema（zod），用于校验模型返回值。
import { z } from "zod";

export const ExtractedNodeSchema = z.object({
  name: z.string().min(1).max(120),
  definition: z.string().min(1).max(2000).optional(),
  detail: z.string().max(8000).optional(),
  chapter: z.string().max(200).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  source_page: z.number().int().positive().optional(),
});

export const ExtractedEdgeSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  relation_type: z.enum(["prerequisite", "related", "contains", "example_of"]),
  evidence: z.string().max(500).optional(),
  confidence: z.number().min(0).max(1).optional(),
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
  difficulty: z.number().int().min(1).max(5).optional(),
});

export const QuizGenerationSchema = z.object({
  questions: z.array(QuizQuestionSchema).min(1).max(20),
});

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;
export type ExtractedEdge = z.infer<typeof ExtractedEdgeSchema>;
export type KnowledgeExtraction = z.infer<typeof KnowledgeExtractionSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizGeneration = z.infer<typeof QuizGenerationSchema>;
