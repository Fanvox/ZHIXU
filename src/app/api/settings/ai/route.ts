import { json, error, requireUser, handleError } from "@/lib/http";
import { getUserSettings, upsertUserSettings } from "@/lib/db/repo";
import { isAIEnabled } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const s = getUserSettings(user.id);
    return json({
      ai_api_key: s?.ai_api_key ?? "",
      ai_base_url: s?.ai_base_url ?? "",
      ai_model: s?.ai_model ?? "",
      ai_extract_model: s?.ai_extract_model ?? "",
      env_configured: isAIEnabled() && !(s?.ai_api_key?.trim()),
      ai_enabled: isAIEnabled(user.id),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = await req.json().catch(() => ({}));
    const s = upsertUserSettings(user.id, {
      ai_api_key: String(body.ai_api_key ?? "").trim() || null,
      ai_base_url: String(body.ai_base_url ?? "").trim() || null,
      ai_model: String(body.ai_model ?? "").trim() || null,
      ai_extract_model: String(body.ai_extract_model ?? "").trim() || null,
    });
    return json({
      ai_api_key: s.ai_api_key ?? "",
      ai_base_url: s.ai_base_url ?? "",
      ai_model: s.ai_model ?? "",
      ai_extract_model: s.ai_extract_model ?? "",
      ai_enabled: isAIEnabled(user.id),
    });
  } catch (e) {
    return handleError(e);
  }
}
