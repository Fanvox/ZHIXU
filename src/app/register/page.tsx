"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Network } from "lucide-react";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return toast({ title: t("auth.fillAll"), variant: "error" });
    if (password !== confirm) return toast({ title: t("auth.passwordMismatch"), variant: "error" });
    setLoading(true);
    try {
      await api.post("/api/auth/register", { name, email, password });
      toast({ title: t("auth.registerSuccess"), variant: "success" });
      router.push("/");
      router.refresh();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : t("auth.emailExists"), variant: "error" });
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
            <h1 className="text-2xl font-semibold tracking-tight">{t("auth.registerTitle")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("auth.registerSubtitle")}</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label>{t("auth.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auth.name")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.email")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.password")}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.passwordHint")} autoComplete="new-password" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("auth.confirmPassword")}</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={t("auth.confirmPassword")} autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Spinner />}
            {t("auth.registerTitle")}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("auth.goLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
