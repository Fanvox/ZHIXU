import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listSessions, createSession, addMessage, getCourse, getChatSession, listMessages } from "@/lib/db/repo";
import { tutorReply, type TutorTurn } from "@/lib/services/tutor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ courseId: string }> };

/** 带入模型的历史消息条数 */
const HISTORY_LIMIT = 6;

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

    const course = withDb(() => getCourse(courseId));
    if (!course) return error("课程不存在", 404);
    if (course.owner_id !== user.id) return error("无权访问", 403);

    let sessionId = String(body.session_id ?? "");
    const history: TutorTurn[] = [];

    const setup = withDb(() => {
      if (!sessionId) {
        // 新会话：标题取首个问题前 40 字
        return { id: createSession(courseId, user.id, question.slice(0, 40)), error: null as null | string };
      }
      // 已有会话：校验归属，并取出最近的历史消息用于理解追问
      const session = getChatSession(sessionId);
      if (!session) return { id: "", error: "会话不存在" };
      if (session.user_id !== user.id || session.course_id !== courseId) {
        return { id: "", error: "无权访问" };
      }
      for (const m of listMessages(sessionId).slice(-HISTORY_LIMIT)) {
        if (m.role === "user" || m.role === "assistant") {
          history.push({ role: m.role as "user" | "assistant", content: m.content });
        }
      }
      return { id: sessionId, error: null as null | string };
    });

    if (setup.error) return error(setup.error, setup.error === "无权访问" ? 403 : 404);
    sessionId = setup.id;

    withDb(() => addMessage({ session_id: sessionId, role: "user", content: question }));

    const reply = await tutorReply(
      courseId,
      question,
      body.selected_node_id ? String(body.selected_node_id) : null,
      user.id,
      history
    );

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
