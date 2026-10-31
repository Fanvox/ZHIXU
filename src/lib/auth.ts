// 本地认证 —— 密码加盐哈希、Cookie 会话、当前用户解析。
// 生产环境可平滑替换为 Supabase Auth（profiles 表已按 auth.users 设计）。
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import {
  getUserById,
  getSessionByTokenHash,
  createSessionRecord,
  deleteSessionByTokenHash,
} from "./db/repo";
import type { Profile } from "./types";

export const SESSION_COOKIE = "zhixu_session";
const SESSION_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

export function issueSession(userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString();
  createSessionRecord(userId, hashToken(token), expiresAt);
  return { token, expiresAt };
}

export async function getCurrentUser(): Promise<Profile | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = getSessionByTokenHash(hashToken(token));
  if (!session || new Date(session.expires_at).getTime() < Date.now()) return null;
  return getUserById(session.user_id) ?? null;
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86400,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function logoutCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSessionByTokenHash(hashToken(token));
  store.delete(SESSION_COOKIE);
}

/** 返回给客户端的用户信息（剥离敏感字段）。 */
export function publicUser(user: Profile) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
  };
}
