import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { getDocument, getCourse } from "@/lib/db/repo";
import { processDocument, removeDocument } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ docId: string }> };

function checkDocOwnership(docId: string, userId: string) {
  const doc = getDocument(docId);
  if (!doc) return { ok: false, res: error("文档不存在", 404) };
  const course = getCourse(doc.course_id);
  if (!course || course.owner_id !== userId) return { ok: false, res: error("无权访问", 403) };
  return { ok: true, doc };
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const { docId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const c = withDb(() => checkDocOwnership(docId, user.id));
    if (!c.ok) return c.res;
    const result = await processDocument(docId, user.id);
    return json({ document: getDocument(docId), extraction: { node_count: result.nodes.length, edge_count: result.edges.length, mode: result.mode } });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { docId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const c = withDb(() => checkDocOwnership(docId, user.id));
    if (!c.ok) return c.res;
    await removeDocument(docId);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
