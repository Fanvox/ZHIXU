import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listQuizzes, getCourse } from "@/lib/db/repo";
import { generateQuiz } from "@/lib/services/quiz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ courseId: string }> };

function checkOwnership(courseId: string, userId: string) {
  const course = getCourse(courseId);
  if (!course) return { ok: false, res: error("课程不存在", 404) };
  if (course.owner_id !== userId) return { ok: false, res: error("无权访问", 403) };
  return { ok: true };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const c = checkOwnership(courseId, user.id);
      if (!c.ok) return c.res;
      return json(listQuizzes(courseId));
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const nodeIds = Array.isArray(body.node_ids) ? body.node_ids.map(String) : undefined;
    const count = Number(body.count) || 5;
    const c = withDb(() => checkOwnership(courseId, user.id));
    if (!c.ok) return c.res;
    const result = await generateQuiz(courseId, nodeIds, count, user.id);
    return json(result, 201);
  } catch (e) {
    return handleError(e);
  }
}
