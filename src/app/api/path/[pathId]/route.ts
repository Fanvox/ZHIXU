import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { updatePathItem, updatePathStatus, listPathItems, getPath } from "@/lib/db/repo";
import { getPathView } from "@/lib/services/learning-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ pathId: string }> };

function checkOwnership(pathId: string, userId: string) {
  const path = getPath(pathId);
  if (!path) return { ok: false, res: error("学习路径不存在", 404) };
  if (path.user_id !== userId) return { ok: false, res: error("无权访问", 403) };
  return { ok: true };
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { pathId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const c = checkOwnership(pathId, user.id);
      if (!c.ok) return c.res;
      const view = getPathView(pathId);
      if (!view) return error("学习路径不存在", 404);
      return json(view);
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { pathId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const itemId = String(body.item_id ?? "");
    const status = String(body.status ?? "");
    if (!itemId || !["pending", "in_progress", "completed", "skipped"].includes(status)) {
      return error("参数错误");
    }
    return withDb(() => {
      const c = checkOwnership(pathId, user.id);
      if (!c.ok) return c.res;
      updatePathItem(itemId, status);
      const items = listPathItems(pathId);
      const done = items.every((i) => i.status === "completed" || i.status === "skipped");
      if (done && items.length > 0) updatePathStatus(pathId, "completed");
      else updatePathStatus(pathId, "in_progress");
      return json(getPathView(pathId));
    });
  } catch (e) {
    return handleError(e);
  }
}
