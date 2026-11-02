import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { getDocument, getCourse, listChunksPaged } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ docId: string }> };

/** 查看资料解析后的文本分块（用于确认解析质量 / 直接阅读原文）。 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { docId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);

    const url = new URL(req.url);
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "10") || 10));

    return withDb(() => {
      const doc = getDocument(docId);
      if (!doc) return error("文档不存在", 404);
      const course = getCourse(doc.course_id);
      if (!course || course.owner_id !== user.id) return error("无权访问", 403);

      const { chunks, total } = listChunksPaged(docId, offset, limit);
      return json({
        document: doc,
        total,
        offset,
        limit,
        chunks: chunks.map((c) => ({
          index: c.chunk_index,
          page_start: c.page_start,
          section: c.section,
          content: c.content,
        })),
      });
    });
  } catch (e) {
    return handleError(e);
  }
}
