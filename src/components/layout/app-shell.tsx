"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Network, LayoutDashboard, BookOpen, GraduationCap, Settings, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFetch } from "@/lib/use-fetch";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "./theme-toggle";
import { LanguageToggle } from "./language-toggle";
import { useState } from "react";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Network className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">知序</div>
        <div className="text-[10px] text-muted-foreground">Zhixu</div>
      </div>
    </Link>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const NAV = [
    { href: "/", label: t("nav.home"), icon: LayoutDashboard, exact: true },
    { href: "/courses", label: t("nav.courses"), icon: BookOpen, exact: false },
    { href: "/profile", label: t("nav.profile"), icon: GraduationCap, exact: false },
    { href: "/settings", label: t("nav.settings"), icon: Settings, exact: false },
  ];
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

interface MeData {
  user: { id: string; name: string; email: string };
}

/**
 * 应用外壳。
 *
 * 登录 / 注册页只渲染纯内容，不渲染侧边栏，也**不请求 `/api/auth/me`**。
 * 原因：未登录时该接口返回 401，会触发客户端「未登录 → 跳转登录页」逻辑，
 * 导致注册页刚打开就被弹回登录页。
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  if (isAuthPage) {
    return <div className="min-h-screen">{children}</div>;
  }
  return <Shell>{children}</Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const me = useFetch<MeData>("/api/auth/me");
  const { t } = useI18n();

  async function logout() {
    try {
      await api.post("/api/auth/logout");
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  }

  const userFooter = (
    <div className="space-y-3 border-t p-3">
      <div className="flex items-center gap-2.5 px-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {(me.data?.user.name ?? "Z").slice(0, 1)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{me.data?.user.name ?? "…"}</p>
          <p className="truncate text-xs text-muted-foreground">{me.data?.user.email ?? ""}</p>
        </div>
      </div>
      <div className="flex items-center justify-between px-1.5">
        <div className="flex items-center">
          <ThemeToggle />
          <LanguageToggle />
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <NavItems />
        </div>
        {userFooter}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-card">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <Brand />
              <button onClick={() => setOpen(false)} className="text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-4">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
            {userFooter}
          </aside>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur md:hidden">
        <button onClick={() => setOpen(true)} className="text-foreground">
          <Menu className="h-5 w-5" />
        </button>
        <Brand />
        <div className="ml-auto flex items-center">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      <main className="md:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
