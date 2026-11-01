import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PAGES = new Set(["/login", "/register"]);

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpe?g|svg|ico|webp|gif|woff2?|css|js|map|webmanifest)$/i.test(pathname)
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("zhixu_session")?.value;
  const isApi = pathname.startsWith("/api");

  // 未登录访问受保护页面 → 跳转登录页
  if (!token && !isApi && !AUTH_PAGES.has(pathname) && !isStaticAsset(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 已登录访问登录/注册页 → 跳首页
  if (token && AUTH_PAGES.has(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // 排除 API 路由（API 各自鉴权，且避免中间件 10MB 请求体限制影响文件上传）
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
