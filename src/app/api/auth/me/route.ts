import { json, error, requireUser, handleError } from "@/lib/http";
import { publicUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return json({ user: publicUser(user), ai_enabled: isAIEnabled(user.id) });
  } catch (e) {
    return handleError(e);
  }
}
