import { NextResponse } from "next/server";
import { ensureSeeded } from "./db/bootstrap";
import { getCurrentUser } from "./auth";
import type { Profile } from "./types";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function ok(data: unknown = { ok: true }): NextResponse {
  return NextResponse.json(data, { status: 200 });
}

export function withDb<T>(handler: () => T): T {
  ensureSeeded();
  return handler();
}

export function handleError(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[api]", err);
  return error(msg, 500);
}

/** 解析当前登录用户；未登录返回 null。 */
export async function requireUser(): Promise<Profile | null> {
  return getCurrentUser();
}
