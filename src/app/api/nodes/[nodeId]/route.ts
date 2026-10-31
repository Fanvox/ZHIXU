import { NextResponse } from "next/server";
import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { getNode, updateNode, deleteNode, listEdges, listNodes, getDocument, getCourse } from "@/lib/db/repo";
import type { KnowledgeNode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ nodeId: string }> };

function checkNodeOwnership(nodeId: string, userId: string): NextResponse | KnowledgeNode {
  const node = getNode(nodeId);
  if (!node) return error("知识点不存在", 404);
  const course = getCourse(node.course_id);
  if (!course || course.owner_id !== userId) return error("无权访问", 403);
  return node;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { nodeId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const node = checkNodeOwnership(nodeId, user.id);
      if (node instanceof NextResponse) return node;
      const edges = listEdges(node.course_id);
      const nodes = listNodes(node.course_id);
      const nodeById = new Map(nodes.map((n) => [n.id, n]));

      const prerequisites: { node: (typeof nodes)[number]; relation_type: string; confidence: number }[] = [];
      const related: { node: (typeof nodes)[number]; relation_type: string; confidence: number }[] = [];
      const dependents: { node: (typeof nodes)[number]; relation_type: string; confidence: number }[] = [];

      for (const e of edges) {
        if (e.target_node_id === node.id && e.relation_type === "prerequisite") {
          const n = nodeById.get(e.source_node_id);
          if (n) prerequisites.push({ node: n, relation_type: e.relation_type, confidence: e.confidence });
        } else if (e.source_node_id === node.id && e.relation_type === "prerequisite") {
          const n = nodeById.get(e.target_node_id);
          if (n) dependents.push({ node: n, relation_type: e.relation_type, confidence: e.confidence });
        } else if (e.source_node_id === node.id || e.target_node_id === node.id) {
          const otherId = e.source_node_id === node.id ? e.target_node_id : e.source_node_id;
          const n = nodeById.get(otherId);
          if (n) related.push({ node: n, relation_type: e.relation_type, confidence: e.confidence });
        }
      }

      const sourceDoc = node.source_document_id ? getDocument(node.source_document_id) : null;

      return json({
        node,
        prerequisites,
        dependents,
        related,
        source: sourceDoc
          ? { document_id: sourceDoc.id, document_name: sourceDoc.filename, page: node.source_page }
          : null,
      });
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { nodeId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};
    const allowed = ["name", "definition", "detail", "chapter", "difficulty", "mastery_status", "verified"];
    for (const k of allowed) {
      if (body[k] !== undefined) patch[k] = body[k];
    }
    if (patch.name !== undefined && !String(patch.name).trim()) return error("知识点名称不能为空");
    return withDb(() => {
      const owned = checkNodeOwnership(nodeId, user.id);
      if (owned instanceof NextResponse) return owned;
      const node = updateNode(nodeId, {
        name: patch.name as string,
        definition: patch.definition as string | null,
        detail: patch.detail as string | null,
        chapter: patch.chapter as string | null,
        difficulty: patch.difficulty as 1 | 2 | 3 | 4 | 5,
        mastery_status: patch.mastery_status as never,
        verified: patch.verified as boolean,
      });
      if (!node) return error("知识点不存在", 404);
      return json(node);
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { nodeId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const owned = checkNodeOwnership(nodeId, user.id);
      if (owned instanceof NextResponse) return owned;
      deleteNode(nodeId);
      return json({ ok: true });
    });
  } catch (e) {
    return handleError(e);
  }
}
