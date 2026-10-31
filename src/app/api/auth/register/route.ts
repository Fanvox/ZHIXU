import { json, error, withDb, handleError } from "@/lib/http";
import { getUserByEmail, createUser } from "@/lib/db/repo";
import { hashPassword, issueSession, setSessionCookie, publicUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name) return error("请输入昵称");
    if (name.length > 40) return error("昵称过长");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error("邮箱格式不正确");
    if (password.length < 6) return error("密码至少需要 6 位");
    if (password.length > 72) return error("密码过长");

    const result = withDb(() => {
      if (getUserByEmail(email)) return { conflict: true, user: null };
      const user = createUser(name, email, hashPassword(password));
      return { conflict: false, user };
    });

    if (result.conflict) return error("该邮箱已注册", 409);

    const session = issueSession(result.user!.id);
    await setSessionCookie(session.token);
    return json({ user: publicUser(result.user!) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
