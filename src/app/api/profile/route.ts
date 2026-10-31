import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listCourses, listNodes } from "@/lib/db/repo";
import { all } from "@/lib/db/driver";
import { isAIEnabled } from "@/lib/ai/provider";
import { publicUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const courses = listCourses(user.id);
      const totalNodes = courses.reduce((sum, c) => sum + c.stats.node_count, 0);
      const totalMastered = courses.reduce((sum, c) => sum + c.stats.mastered_count, 0);
      const totalReview = courses.reduce((sum, c) => sum + c.stats.review_count, 0);

      const recentRecords = all<Record<string, unknown>>(
        `SELECT lr.id, lr.action_type AS actionType, lr.detail, lr.created_at AS createdAt,
          lr.course_id AS courseId, kn.name AS nodeName
         FROM learning_records lr
         LEFT JOIN knowledge_nodes kn ON kn.id = lr.node_id
         WHERE lr.user_id = ?
         ORDER BY lr.created_at DESC LIMIT 12`,
        [user.id]
      ).map((r) => ({
        id: String(r.id),
        action_type: String(r.actionType),
        detail: r.detail == null ? null : String(r.detail),
        created_at: String(r.createdAt),
        course_id: String(r.courseId),
        node_name: r.nodeName == null ? null : String(r.nodeName),
      }));

      const recentAttempts = all<Record<string, unknown>>(
        `SELECT qa.id, qa.score, qa.created_at AS createdAt, q.title AS quizTitle, q.course_id AS courseId
         FROM quiz_attempts qa JOIN quizzes q ON q.id = qa.quiz_id
         WHERE qa.user_id = ? ORDER BY qa.created_at DESC LIMIT 8`,
        [user.id]
      ).map((r) => ({
        id: String(r.id),
        score: Number(r.score),
        created_at: String(r.createdAt),
        quiz_title: String(r.quizTitle),
        course_id: String(r.courseId),
      }));

      const reviewNodes = courses
        .flatMap((c) => listNodes(c.id))
        .filter((n) => n.mastery_status === "review");

      return json({
        profile: publicUser(user),
        ai_enabled: isAIEnabled(user.id),
        summary: {
          course_count: courses.length,
          node_count: totalNodes,
          mastered_count: totalMastered,
          review_count: totalReview,
          overall_progress: totalNodes === 0 ? 0 : Math.round((totalMastered / totalNodes) * 100),
        },
        recent_records: recentRecords,
        recent_attempts: recentAttempts,
        review_nodes: reviewNodes.slice(0, 8).map((n) => ({ id: n.id, name: n.name, course_id: n.course_id })),
      });
    });
  } catch (e) {
    return handleError(e);
  }
}
