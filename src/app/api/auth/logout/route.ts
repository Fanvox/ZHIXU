import { json, handleError } from "@/lib/http";
import { logoutCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await logoutCurrentSession();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
