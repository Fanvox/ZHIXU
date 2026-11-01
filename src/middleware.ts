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

  // 注意：不再根据“是否有 Cookie”把登录页重定向回首页，
  // 否则失效的旧 Cookie 会导致 / 与 /login 之间无限循环。
  // “已登录访问登录页”的重定向改由登录/注册页在客户端自行判断（见 auth/me）。

  return NextResponse.next();
}

export const config = {
  // 排除 API 路由（API 各自鉴权，且避免中间件 10MB 请求体限制影响文件上传）
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
