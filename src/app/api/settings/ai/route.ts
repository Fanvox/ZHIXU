import { json, error, requireUser, handleError } from "@/lib/http";
import { getUserSettings, upsertUserSettings } from "@/lib/db/repo";
import { aiConfig, isAIEnabled, isValidBaseUrl, maskApiKey, normalizeBaseUrl } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 返回给前端的配置摘要。
 * 安全说明：**绝不下发完整 API Key**，只给出「是否已配置」与掩码预览。
 */
function summary(userId: string) {
  const s = getUserSettings(userId);
  const cfg = aiConfig(userId);
  const userKeySet = !!s?.ai_api_key?.trim();
  const envKeySet = !!process.env.AI_API_KEY?.trim();
  return {
    ai_api_key_set: userKeySet,
    ai_api_key_masked: maskApiKey(s?.ai_api_key),
    ai_base_url: s?.ai_base_url ?? "",
    ai_model: s?.ai_model ?? "",
    ai_extract_model: s?.ai_extract_model ?? "",
    env_configured: envKeySet,
    ai_source: userKeySet ? "user" : envKeySet ? "env" : "none",
    ai_enabled: isAIEnabled(userId),
    // 实际生效的配置（便于用户确认 fallback 结果）
    effective_base_url: cfg.baseUrl,
    effective_model: cfg.model,
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return json(summary(user.id));
  } catch (e) {
    return handleError(e);
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const existing = getUserSettings(user.id);

    // ---- Base URL 校验 ----
    const rawBase = body.ai_base_url === undefined ? undefined : String(body.ai_base_url ?? "").trim();
    if (rawBase !== undefined && rawBase !== "" && !isValidBaseUrl(rawBase)) {
      return error("接口地址无效：需以 http:// 或 https:// 开头并包含域名（例如 https://api.deepseek.com）", 400);
    }

    const readText = (v: unknown, max: number): string | null => {
      if (v === undefined) return null;
      const s = String(v ?? "").trim();
      if (!s) return null;
      return s.slice(0, max);
    };

    // ---- API Key 处理 ----
    // 规则：未传 / 传空 / 传掩码值 → 保留原 Key；clear_api_key=true → 清除；其余非空值 → 更新
    let apiKey: string | null = existing?.ai_api_key ?? null;
    if (body.clear_api_key === true) {
      apiKey = null;
    } else if (typeof body.ai_api_key === "string") {
      const k = body.ai_api_key.trim();
      if (k && !k.includes("…")) apiKey = k.slice(0, 200);
    }

    upsertUserSettings(user.id, {
      ai_api_key: apiKey,
      ai_base_url:
        rawBase === undefined ? (existing?.ai_base_url ?? null) : rawBase ? normalizeBaseUrl(rawBase) : null,
      ai_model: body.ai_model === undefined ? (existing?.ai_model ?? null) : readText(body.ai_model, 100),
      ai_extract_model:
        body.ai_extract_model === undefined
          ? (existing?.ai_extract_model ?? null)
          : readText(body.ai_extract_model, 100),
    });

    return json(summary(user.id));
  } catch (e) {
    return handleError(e);
  }
}
