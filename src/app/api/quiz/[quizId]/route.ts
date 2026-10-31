import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { getQuizView, listAttempts, getQuizMeta, getCourse } from "@/lib/db/repo";
import { gradeQuiz } from "@/lib/services/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ quizId: string }> };

function checkOwnership(quizId: string, userId: string) {
  const quiz = getQuizMeta(quizId);
  if (!quiz) return { ok: false, res: error("测验不存在", 404) };
  const course = getCourse(quiz.course_id);
  if (!course || course.owner_id !== userId) return { ok: false, res: error("无权访问", 403) };
  return { ok: true };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { quizId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const c = checkOwnership(quizId, user.id);
      if (!c.ok) return c.res;
      const quiz = getQuizView(quizId);
      if (!quiz) return error("测验不存在", 404);
      return json({ ...quiz, attempts: listAttempts(quizId) });
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { quizId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const answers = body.answers ?? {};
    if (typeof answers !== "object" || Array.isArray(answers)) return error("答案格式错误");
    const c = withDb(() => checkOwnership(quizId, user.id));
    if (!c.ok) return c.res;
    const result = withDb(() => gradeQuiz(quizId, answers as Record<string, string>, user.id));
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
