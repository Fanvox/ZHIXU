import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { latestPathFor, getCourse } from "@/lib/db/repo";
import { getOrCreateLatestPath, getPathView } from "@/lib/services/learning-path";

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
      const path = latestPathFor(courseId, user.id);
      if (!path) return json(null);
      return json(getPathView(path.id));
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
    const target = String(body.target_node_id ?? "");
    if (!target) return error("请选择目标知识点");
    return withDb(() => {
      const c = checkOwnership(courseId, user.id);
      if (!c.ok) return c.res;
      const { pathId } = getOrCreateLatestPath(courseId, target, user.id);
      return json(getPathView(pathId), 201);
    });
  } catch (e) {
    return handleError(e);
  }
}
