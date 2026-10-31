import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listNodes, createNode, getCourse } from "@/lib/db/repo";

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
      return json(listNodes(courseId));
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
    const name = String(body.name ?? "").trim();
    if (!name) return error("知识点名称不能为空");
    const node = withDb(() => {
      const c = checkOwnership(courseId, user.id);
      if (!c.ok) return c.res;
      return json(
        createNode({
          course_id: courseId,
          name,
          definition: body.definition?.trim() || null,
          detail: body.detail?.trim() || null,
          chapter: body.chapter?.trim() || null,
          difficulty: (Number(body.difficulty) || 3) as 1 | 2 | 3 | 4 | 5,
          verified: true,
        }),
        201
      );
    });
    return node;
  } catch (e) {
    return handleError(e);
  }
}
