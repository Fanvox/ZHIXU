import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listCourses, createCourse } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return json(withDb(() => listCourses(user.id)));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) return error("课程名称不能为空");
    if (name.length > 100) return error("课程名称过长");
    const course = withDb(() => createCourse(name, body.description?.trim() || null, user.id));
    return json(course, 201);
  } catch (e) {
    return handleError(e);
  }
}
