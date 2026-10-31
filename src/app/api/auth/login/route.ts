import { json, error, withDb, handleError } from "@/lib/http";
import { getUserByEmail } from "@/lib/db/repo";
import { verifyPassword, issueSession, setSessionCookie, publicUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) return error("请输入邮箱和密码");

    const user = withDb(() => getUserByEmail(email));
    if (!user || !verifyPassword(password, user.password_hash)) {
      return error("邮箱或密码错误", 401);
    }

    const session = issueSession(user.id);
    await setSessionCookie(session.token);
    return json({ user: publicUser(user) });
  } catch (e) {
    return handleError(e);
  }
}
