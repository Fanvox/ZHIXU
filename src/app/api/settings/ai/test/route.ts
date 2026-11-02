import { json, error, requireUser, handleError } from "@/lib/http";
import { testAiConnection } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 测试当前用户已保存的 AI 配置是否可用（不会下发 API Key）。 */
export async function POST() {
  try {
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    const result = await testAiConnection(user.id);
    return json(result);
  } catch (e) {
    return handleError(e);
  }
}
