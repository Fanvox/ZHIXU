import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { getGraph, getCourse } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ courseId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const course = getCourse(courseId);
      if (!course) return error("课程不存在", 404);
      if (course.owner_id !== user.id) return error("无权访问", 403);
      return json(getGraph(courseId));
    });
  } catch (e) {
    return handleError(e);
  }
}
