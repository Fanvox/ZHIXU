"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Map, Flag, Check, Circle, Sparkles, ArrowRight } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseNav } from "@/components/course-nav";
import { MasteryBadge } from "@/components/mastery";
import { EmptyState } from "@/components/empty-state";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { KnowledgeNode, LearningPathView } from "@/lib/types";

export default function LearningPathPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const nodes = useFetch<KnowledgeNode[]>(`/api/courses/${courseId}/nodes`);
  const { t } = useI18n();
  const [path, setPath] = useState<LearningPathView | null>(null);
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const nodeOptions = (nodes.data ?? []).map((n) => ({ value: n.id, label: n.name }));

  async function generate() {
    if (!target) return toast({ title: "请选择目标知识点", variant: "error" });
    setLoading(true);
    try {
      const p = await api.post<LearningPathView>(`/api/courses/${courseId}/path`, { target_node_id: target });
      setPath(p);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "生成失败", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function markItem(itemId: string, status: "completed" | "pending") {
    setUpdating(itemId);
    try {
      const p = await api.patch<LearningPathView>(`/api/path/${path!.id}`, { item_id: itemId, status });
      setPath(p);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "更新失败", variant: "error" });
    } finally {
      setUpdating(null);
    }
  }

  const completed = path?.items.filter((i) => i.status === "completed" || i.status === "skipped").length ?? 0;
  const total = path?.items.length ?? 0;

  return (
    <div className="space-y-4">
      <CourseNav courseId={courseId} />

      <div>
        <h1 className="text-lg font-semibold">{t("path.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("path.subtitle")}</p>
      </div>

      {/* Target selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium">{t("path.target")}</label>
              <Select value={target} onChange={setTarget} options={nodeOptions} placeholder={t("path.targetPlaceholder")} />
            </div>
            <Button onClick={generate} disabled={loading || !target}>
              {loading ? <Spinner /> : <Sparkles className="h-4 w-4" />}
              {t("path.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-40 w-full" />}

      {!loading && !path && (
        <EmptyState
          icon={Map}
          title={t("path.emptyTitle")}
          description={t("path.emptyDesc")}
        />
      )}

      {!loading && path && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Flag className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">{t("path.goal")}</span>
                  <span className="font-semibold">{path.target_node_name}</span>
                </div>
                <Badge variant={path.status === "completed" ? "success" : "secondary"}>
                  {path.status === "completed" ? t("path.completed") : t("path.inProgress")}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={total ? Math.round((completed / total) * 100) : 0} className="flex-1" />
                <span className="text-xs text-muted-foreground">{completed}/{total}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-0">
            {path.items.map((item, i) => (
              <div key={item.id} className="relative flex gap-4">
                {/* timeline connector */}
                {i < path.items.length - 1 && <span className="absolute left-[15px] top-9 h-full w-px bg-border" />}
                <div className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-card">
                  {item.status === "completed" ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : item.status === "skipped" ? (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                  )}
                </div>
                <Card className={cn("mb-3 flex-1", item.skipped && "opacity-70")}>
                  <CardContent className="flex flex-wrap items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/courses/${courseId}/graph?node=${item.node_id}`} className="font-medium hover:text-primary">
                          {item.node_name}
                        </Link>
                        <MasteryBadge status={item.mastery_status} />
                        {item.chapter && <span className="text-xs text-muted-foreground">{item.chapter}</span>}
                        <span className="text-xs text-muted-foreground">难度 {"●".repeat(item.difficulty)}</span>
                      </div>
                      {item.skipped && (
                        <p className="mt-1 text-xs text-muted-foreground">已掌握，自动跳过</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/courses/${courseId}/graph?node=${item.node_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        查看 <ArrowRight className="h-3 w-3" />
                      </Link>
                      {!item.skipped && item.status !== "completed" && (
                        <Button size="sm" variant="outline" disabled={updating === item.id} onClick={() => markItem(item.id, "completed")}>
                          {updating === item.id ? <Spinner /> : <Check className="h-4 w-4" />} {t("path.markDone")}
                        </Button>
                      )}
                      {item.status === "completed" && (
                        <Button size="sm" variant="ghost" disabled={updating === item.id} onClick={() => markItem(item.id, "pending")}>
                          {t("path.undo")}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {path.status === "completed" && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="flex items-center justify-center gap-2 font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-5 w-5" /> 恭喜！你已完成「{path.target_node_name}」的学习路径
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        {t("path.footnote")}
      </div>
    </div>
  );
}
