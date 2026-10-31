import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listMessages, getChatSession } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ sessionId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { sessionId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const session = getChatSession(sessionId);
      if (!session) return error("会话不存在", 404);
      if (session.user_id !== user.id) return error("无权访问", 403);
      const messages = listMessages(sessionId).map((m) => ({
        role: m.role,
        content: m.content,
        sources: JSON.parse(m.sources),
        node_refs: JSON.parse(m.node_refs),
        created_at: m.created_at,
      }));
      return json(messages);
    });
  } catch (e) {
    return handleError(e);
  }
}
