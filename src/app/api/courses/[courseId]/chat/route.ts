import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listSessions, createSession, addMessage, getCourse } from "@/lib/db/repo";
import { tutorReply } from "@/lib/services/tutor";

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
      return json(listSessions(courseId, user.id));
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
    const question = String(body.question ?? "").trim();
    if (!question) return error("问题不能为空");
    if (question.length > 2000) return error("问题过长");

    let sessionId: string = String(body.session_id ?? "");
    withDb(() => {
      const course = getCourse(courseId);
      if (!course) throw new Error("课程不存在");
      if (course.owner_id !== user.id) throw new Error("无权访问");
      if (!sessionId) {
        sessionId = createSession(courseId, user.id, question.slice(0, 40));
      }
      addMessage({ session_id: sessionId, role: "user", content: question });
    });

    const reply = await tutorReply(courseId, question, body.selected_node_id ?? null, user.id);

    withDb(() =>
      addMessage({
        session_id: sessionId,
        role: "assistant",
        content: reply.content,
        sources: reply.sources,
        node_refs: reply.nodeRefs,
      })
    );

    return json({ session_id: sessionId, reply });
  } catch (e) {
    return handleError(e);
  }
}
