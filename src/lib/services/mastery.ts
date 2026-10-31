// 掌握度服务 —— 透明、可解释的规则评分（非机器学习）。
// 规则：score = 答对次数×1.0 + 复习×0.4 + 讲解×0.2 − 答错×0.7
//       无任何记录 → untouched；score≥2 → mastered；score<0 → review；其余 → learning
import { all } from "../db/driver";
import { addRecord, setMastery } from "../db/repo";
import type { MasteryStatus } from "../types";

interface RecordRow {
  action_type: string;
  score: number | null;
}

export function computeMasteryScore(records: RecordRow[]): number {
  let score = 0;
  for (const r of records) {
    switch (r.action_type) {
      case "quiz_correct":
        score += 1;
        break;
      case "quiz_wrong":
        score -= 0.7;
        break;
      case "review":
        score += 0.4;
        break;
      case "explain":
        score += 0.2;
        break;
      case "learn_complete":
        score += 0.5;
        break;
      default:
        break;
    }
  }
  return score;
}

export function scoreToStatus(score: number, hasActivity: boolean): MasteryStatus {
  if (!hasActivity) return "untouched";
  if (score >= 2) return "mastered";
  if (score < 0) return "review";
  return "learning";
}

export function getRecordsForNode(nodeId: string, userId: string): RecordRow[] {
  return all<RecordRow>(
    "SELECT action_type, score FROM learning_records WHERE node_id = ? AND user_id = ?",
    [nodeId, userId]
  );
}

/** 记录一次学习行为并重算该知识点的掌握状态。 */
export function recordAndUpdateMastery(input: {
  user_id: string;
  course_id: string;
  node_id: string | null;
  action_type: string;
  detail?: string | null;
  score?: number | null;
}): MasteryStatus | null {
  addRecord(input);
  if (!input.node_id) return null;
  const records = getRecordsForNode(input.node_id, input.user_id);
  const score = computeMasteryScore(records);
  const status = scoreToStatus(score, records.length > 0);
  setMastery(input.node_id, status);
  return status;
}
