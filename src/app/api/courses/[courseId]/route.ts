import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { getCourse, getCourseStats, updateCourse, deleteCourse } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ courseId: string }> };

function checkOwnership(courseId: string, userId: string) {
  const course = getCourse(courseId);
  if (!course) return { ok: false, res: error("课程不存在", 404) };
  if (course.owner_id !== userId) return { ok: false, res: error("无权访问", 403) };
  return { ok: true, course };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const c = withDb(() => checkOwnership(courseId, user.id));
    if (!c.ok) return c.res;
    return json({ ...c.course, stats: getCourseStats(courseId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) return error("课程名称不能为空");
    const c = withDb(() => checkOwnership(courseId, user.id));
    if (!c.ok) return c.res;
    const course = updateCourse(courseId, name, body.description?.trim() || null);
    return json(course);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const c = withDb(() => checkOwnership(courseId, user.id));
    if (!c.ok) return c.res;
    deleteCourse(courseId);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
