"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Eye, EyeOff, Info, Save, Trash2, XCircle, CheckCircle2, Zap } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";

type AiSource = "user" | "env" | "none";

interface AiSettings {
  ai_api_key_set: boolean;
  ai_api_key_masked: string;
  ai_base_url: string;
  ai_model: string;
  ai_extract_model: string;
  env_configured: boolean;
  ai_source: AiSource;
  ai_enabled: boolean;
  effective_base_url: string;
  effective_model: string;
}

interface TestResult {
  ok: boolean;
  message: string;
  baseUrl: string;
  model: string;
  latencyMs: number;
  source: AiSource;
}

export default function SettingsPage() {
  const { data, loading, reload } = useFetch<AiSettings>("/api/settings/ai");
  const { t } = useI18n();

  // keyInput 默认为空：留空表示「不修改已保存的 Key」
  const [keyInput, setKeyInput] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [extractModel, setExtractModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    if (data) {
      setKeyInput("");
      setBaseUrl(data.ai_base_url ?? "");
      setModel(data.ai_model ?? "");
      setExtractModel(data.ai_extract_model ?? "");
    }
  }, [data]);

  function payloadBase() {
    return {
      ai_base_url: baseUrl,
      ai_model: model,
      ai_extract_model: extractModel,
    };
  }

  async function save() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = payloadBase();
      if (keyInput.trim()) payload.ai_api_key = keyInput.trim();
      const res = await api.put<AiSettings>("/api/settings/ai", payload);
      setKeyInput("");
      setTestResult(null);
      toast({
        title: res.ai_enabled ? t("settings.savedEnabled") : t("settings.savedDemo"),
        variant: "success",
      });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("toast.saveFailed"), variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function clearKey() {
    if (typeof window !== "undefined" && !window.confirm(t("settings.clearKeyConfirm"))) return;
    setClearing(true);
    try {
      await api.put<AiSettings>("/api/settings/ai", { ...payloadBase(), clear_api_key: true });
      setKeyInput("");
      setTestResult(null);
      toast({ title: t("settings.keyCleared"), variant: "success" });
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("toast.saveFailed"), variant: "error" });
    } finally {
      setClearing(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<TestResult>("/api/settings/ai/test");
      setTestResult(res);
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : t("settings.testFailed"),
        baseUrl: "",
        model: "",
        latencyMs: 0,
        source: "none",
      });
    } finally {
      setTesting(false);
    }
  }

  const sourceLabel =
    data?.ai_source === "user"
      ? t("settings.sourceUser")
      : data?.ai_source === "env"
        ? t("settings.sourceEnv")
        : t("settings.sourceNone");

  // 表单是否有未保存的修改（「测试连接」测的是已保存配置，需先保存）
  const dirty =
    !!data &&
    (keyInput.trim() !== "" ||
      baseUrl !== (data.ai_base_url ?? "") ||
      model !== (data.ai_model ?? "") ||
      extractModel !== (data.ai_extract_model ?? ""));

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-foreground" />
                {t("settings.aiTitle")}
              </CardTitle>
              <CardDescription>{t("settings.aiDesc")}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Badge variant={data?.ai_enabled ? "success" : "secondary"}>
                {data?.ai_enabled ? t("settings.aiEnabled") : t("settings.aiDemo")}
              </Badge>
              <Badge variant="outline">{sourceLabel}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <Skeleton className="h-40 w-full" />}

          {!loading && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>{t("settings.apiKey")}</Label>
                  {data?.ai_api_key_set && (
                    <Button variant="ghost" size="sm" onClick={clearKey} disabled={clearing}>
                      {clearing ? <Spinner /> : <Trash2 className="h-3.5 w-3.5" />}
                      {t("settings.clearKey")}
                    </Button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={
                      data?.ai_api_key_set
                        ? t("settings.keyPlaceholderSet", { masked: data.ai_api_key_masked })
                        : t("settings.keyPlaceholderEmpty")
                    }
                    className="pr-10"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="toggle"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t("settings.baseUrl")}</Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com 或 https://api.openai.com/v1"
                  autoComplete="off"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("settings.model")}</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-chat" autoComplete="off" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("settings.extractModel")}</Label>
                  <Input
                    value={extractModel}
                    onChange={(e) => setExtractModel(e.target.value)}
                    placeholder={model || t("settings.model")}
                    autoComplete="off"
                  />
                </div>
              </div>

              {data?.ai_enabled && data.effective_base_url && (
                <p className="text-xs text-muted-foreground">
                  {t("settings.effective", { base: data.effective_base_url, model: data.effective_model })}
                </p>
              )}

              {testResult && (
                <div
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${
                    testResult.ok
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {testResult.ok ? t("settings.testSuccess") : t("settings.testFailed")}
                    </p>
                    <p className="break-all opacity-90">{testResult.message}</p>
                    {testResult.baseUrl && (
                      <p className="break-all opacity-70">
                        {testResult.baseUrl} · {testResult.model}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                {t("settings.note")}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {dirty && (
                  <p className="mr-auto text-xs text-amber-600 dark:text-amber-400">{t("settings.saveFirstHint")}</p>
                )}
                <Button variant="outline" onClick={testConnection} disabled={testing || saving || dirty}>
                  {testing ? <Spinner /> : <Zap className="h-4 w-4" />}
                  {testing ? t("settings.testing") : t("settings.test")}
                </Button>
                <Button onClick={save} disabled={saving || clearing}>
                  {saving ? <Spinner /> : <Save className="h-4 w-4" />}
                  {t("settings.save")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
