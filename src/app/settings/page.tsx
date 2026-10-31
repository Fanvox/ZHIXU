"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Eye, EyeOff, Save, Info } from "lucide-react";
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

interface AiSettings {
  ai_api_key: string;
  ai_base_url: string;
  ai_model: string;
  ai_extract_model: string;
  ai_enabled: boolean;
}

export default function SettingsPage() {
  const { data, loading, reload } = useFetch<AiSettings>("/api/settings/ai");
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [extractModel, setExtractModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setKey(data.ai_api_key ?? "");
      setBaseUrl(data.ai_base_url ?? "");
      setModel(data.ai_model ?? "");
      setExtractModel(data.ai_extract_model ?? "");
    }
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      const res = await api.put<AiSettings>("/api/settings/ai", {
        ai_api_key: key,
        ai_base_url: baseUrl,
        ai_model: model,
        ai_extract_model: extractModel,
      });
      setKey(res.ai_api_key ?? "");
      setBaseUrl(res.ai_base_url ?? "");
      setModel(res.ai_model ?? "");
      setExtractModel(res.ai_extract_model ?? "");
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-foreground" />
                {t("settings.aiTitle")}
              </CardTitle>
              <CardDescription>{t("settings.aiDesc")}</CardDescription>
            </div>
            <Badge variant={data?.ai_enabled ? "success" : "secondary"}>
              {data?.ai_enabled ? t("settings.aiEnabled") : t("settings.aiDemo")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <Skeleton className="h-40 w-full" />}

          {!loading && (
            <>
              <div className="space-y-1.5">
                <Label>{t("settings.apiKey")}</Label>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sk-..."
                    className="pr-10"
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
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("settings.model")}</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("settings.extractModel")}</Label>
                  <Input value={extractModel} onChange={(e) => setExtractModel(e.target.value)} placeholder={t("settings.model")} />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                {t("settings.note")}
              </div>

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
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
