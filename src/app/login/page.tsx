"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Network, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast({ title: t("auth.needEmailPassword"), variant: "error" });
    setLoading(true);
    try {
      await api.post("/api/auth/login", { email, password });
      toast({ title: t("auth.loginSuccess"), variant: "success" });
      router.push("/");
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("auth.wrongCredentials"), variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">知序 Zhixu</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.brandSubtitle")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label>{t("auth.email")}</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.password")}</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.password")}
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Spinner />}
            {t("auth.loginTitle")}
          </Button>

          <div className="flex items-center gap-3 pt-1 text-center text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("common.optional")}
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={() => { setEmail("demo@zhixu.app"); setPassword("demo123"); }}>
            <Sparkles className="h-4 w-4" />
            {t("auth.demoLogin")} · demo@zhixu.app / demo123
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("auth.goRegister")}
          </Link>
        </p>
      </div>
    </div>
  );
}
