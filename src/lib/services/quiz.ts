// 测验服务 —— 根据知识图谱生成练习题并判分，更新掌握记录。
import { isAIEnabled, chatCompletionJSON } from "../ai/provider";
import { QuizGenerationSchema, type QuizGeneration } from "../ai/schemas";
import { demoGenerateQuiz } from "../ai/demo";
import { all } from "../db/driver";
import {
  listNodes,
  getNode,
  createQuiz,
  addQuestion,
  getQuizView,
  addAttempt,
} from "../db/repo";
import { recordAndUpdateMastery } from "./mastery";
import type { KnowledgeNode, MasteryStatus, QuestionType } from "../types";

export interface GeneratedQuiz {
  quizId: string;
  title: string;
  mode: "ai" | "demo";
  questionCount: number;
}

/** 生成测验（指定知识点范围，缺省则覆盖整个课程）。 */
export async function generateQuiz(
  courseId: string,
  nodeIds: string[] | undefined,
  count: number,
  userId: string
): Promise<GeneratedQuiz> {
  const allNodes = listNodes(courseId);
  const focus = (nodeIds ?? [])
    .map((id) => getNode(id))
    .filter((n): n is KnowledgeNode => n != null && n.course_id === courseId);
  const title = focus.length
    ? `专题测验 · ${focus.map((n) => n.name).join("、").slice(0, 30)}`
    : "综合测验";

  const quiz = createQuiz(courseId, title, focus.map((n) => n.id));

  let generation: QuizGeneration | null = null;
  let mode: "ai" | "demo" = "demo";

  if (isAIEnabled(userId)) {
    generation = await chatCompletionJSON(userId, QuizGenerationSchema, [
      {
        role: "system",
        content:
          "你是知序学习平台的出题引擎。请根据提供的知识点生成练习题。题型支持 single/multiple/true_false/short_answer/code。每题需关联知识点、给出答案与解析。用简体中文。只输出 JSON。",
      },
      { role: "user", content: buildQuizPrompt(focus.length ? focus : allNodes, count) },
    ]);
    if (generation) mode = "ai";
  }

  if (!generation) {
    generation = demoGenerateQuiz(focus, allNodes);
  }

  const questions = generation.questions.slice(0, count * 2);
  for (const q of questions) {
    addQuestion({
      quiz_id: quiz.id,
      type: q.type,
      stem: q.stem,
      options: q.options ?? [],
      answer: q.answer,
      explanation: q.explanation ?? "",
      node_id: q.node_id ?? null,
      difficulty: q.difficulty ?? 3,
    });
  }

  return { quizId: quiz.id, title: quiz.title, mode, questionCount: questions.length };
}

export interface GradedQuestion {
  questionId: string;
  correct: boolean;
  correctAnswer: string;
  userAnswer: string;
  explanation: string;
  nodeId: string | null;
  nodeName: string | null;
}

export interface GradedResult {
  score: number; // 0-100
  correctCount: number;
  total: number;
  results: GradedQuestion[];
  masteryUpdates: { node_id: string; status: MasteryStatus | null }[];
}

/** 判分并更新掌握度。answers 形如 { [questionId]: "A" | "ACD" | "文本" } */
export function gradeQuiz(
  quizId: string,
  answers: Record<string, string>,
  userId: string
): GradedResult {
  const quiz = getQuizView(quizId);
  if (!quiz) throw new Error("测验不存在");

  const results: GradedQuestion[] = [];
  const masteryUpdates: GradedResult["masteryUpdates"] = [];

  for (const q of quiz.questions) {
    const userAnswer = (answers[q.id] ?? "").trim();
    const normalizedCorrect = normalizeAnswer(q.answer, q.type);
    const correct = normalizeAnswer(userAnswer, q.type) === normalizedCorrect;
    results.push({
      questionId: q.id,
      correct,
      correctAnswer: q.answer,
      userAnswer,
      explanation: q.explanation,
      nodeId: q.node_id,
      nodeName: q.node_name,
    });
    if (q.node_id) {
      const status = recordAndUpdateMastery({
        user_id: userId,
        course_id: quizCourseId(quizId),
        node_id: q.node_id,
        action_type: correct ? "quiz_correct" : "quiz_wrong",
        detail: correct ? `答对：${q.stem.slice(0, 40)}` : `答错：${q.stem.slice(0, 40)}`,
        score: correct ? 1 : 0,
      });
      masteryUpdates.push({ node_id: q.node_id, status });
    }
  }

  const correctCount = results.filter((r) => r.correct).length;
  const total = results.length;
  const score = total === 0 ? 0 : Math.round((correctCount / total) * 100);
  addAttempt({ quiz_id: quizId, user_id: userId, answers, score });

  return { score, correctCount, total, results, masteryUpdates };
}

function quizCourseId(quizId: string): string {
  // 通过 quiz 表反查 course_id
  const row = all<{ course_id: string }>("SELECT course_id FROM quizzes WHERE id = ?", [quizId])[0];
  return row?.course_id ?? "";
}

function normalizeAnswer(a: string, type?: string): string {
  const t = a.trim();
  if (type === "short_answer" || type === "code") {
    return t.toLowerCase().replace(/\s+/g, " ");
  }
  return t
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .sort()
    .join("");
}

function buildQuizPrompt(
  nodes: { id: string; name: string; definition: string | null; detail: string | null; difficulty: number }[],
  count: number
): string {
  const lines = nodes.slice(0, 12).map(
    (n) => `- id:${n.id} | ${n.name}（难度${n.difficulty}）定义：${n.definition ?? ""} 解释：${(n.detail ?? "").slice(0, 200)}`
  );
  return (
    `请基于以下知识点生成约 ${count} 道练习题：\n\n${lines.join("\n")}\n\n` +
    "要求：题型多样（单选/多选/判断/简答/代码）；单选题答案用 A/B/C/D；多选题答案用如 'AC'；判断题 options 为 ['正确','错误']；每题给出 explanation 解析；node_id 关联知识点 id；难度取 1-5。"
  );
}

export type { QuestionType };
