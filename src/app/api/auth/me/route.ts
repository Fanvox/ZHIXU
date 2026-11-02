import { json, error, requireUser, handleError, withDb } from "@/lib/http";
import { publicUser } from "@/lib/auth";
import { isAIEnabled } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 每个页面加载都会调用本接口：借此触发数据库初始化、
    // 恢复上次中断的文档处理任务、启动超时看门狗（幂等，仅每进程执行一次）。
    withDb(() => 0);

    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return json({ user: publicUser(user), ai_enabled: isAIEnabled(user.id) });
  } catch (e) {
    return handleError(e);
  }
}
