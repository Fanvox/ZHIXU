import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { createEdge, deleteEdge, getNode, getCourse } from "@/lib/db/repo";
import type { RelationType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ courseId: string }> };

const VALID_RELATIONS: RelationType[] = ["prerequisite", "related", "contains", "example_of"];

function checkOwnership(courseId: string, userId: string) {
  const course = getCourse(courseId);
  if (!course) return { ok: false, res: error("课程不存在", 404) };
  if (course.owner_id !== userId) return { ok: false, res: error("无权访问", 403) };
  return { ok: true };
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const source = String(body.source_node_id ?? "");
    const target = String(body.target_node_id ?? "");
    const relation = String(body.relation_type ?? "") as RelationType;
    if (!source || !target) return error("缺少源/目标节点");
    if (source === target) return error("源与目标不能相同");
    if (!VALID_RELATIONS.includes(relation)) return error("无效的关系类型");

    return withDb(() => {
      const c = checkOwnership(courseId, user.id);
      if (!c.ok) return c.res;
      const s = getNode(source);
      const t = getNode(target);
      if (!s || !t || s.course_id !== courseId || t.course_id !== courseId) {
        return error("节点不存在或不属于该课程");
      }
      const edge = createEdge({
        course_id: courseId,
        source_node_id: source,
        target_node_id: target,
        relation_type: relation,
        evidence: body.evidence?.trim() || null,
        confidence: 0.9,
        verified: true,
      });
      return json(edge, 201);
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const edgeId = String(body.edge_id ?? "");
    if (!edgeId) return error("缺少 edge_id");
    return withDb(() => {
      const c = checkOwnership(courseId, user.id);
      if (!c.ok) return c.res;
      deleteEdge(edgeId);
      return json({ ok: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
