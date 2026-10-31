"use client";

import Link from "next/link";
import {
  BookOpen,
  Network,
  CheckCircle2,
  RefreshCcw,
  FileText,
  ClipboardCheck,
  Sparkles,
  BrainCircuit,
} from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MasteryBadge } from "@/components/mastery";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/utils";
import type { CourseWithStats } from "@/lib/types";

interface ProfileData {
  profile: { name: string; email: string };
  ai_enabled: boolean;
  summary: { course_count: number; node_count: number; mastered_count: number; review_count: number; overall_progress: number };
  recent_records: { id: string; action_type: string; detail: string | null; created_at: string; node_name: string | null; course_id: string }[];
  recent_attempts: { id: string; score: number; created_at: string; quiz_title: string; course_id: string }[];
  review_nodes: { id: string; name: string; course_id: string }[];
}

const ACTION_LABEL: Record<string, string> = {
  quiz_correct: "答对测验题",
  quiz_wrong: "测验题答错",
  review: "复习了知识点",
  explain: "查看讲解",
  learn_complete: "完成学习",
};

export default function ProfilePage() {
  const profile = useFetch<ProfileData>("/api/profile");
  const courses = useFetch<CourseWithStats[]>("/api/courses");
  const { t } = useI18n();
  const p = profile.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
            {(p?.profile.name ?? "知").slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold">{p?.profile.name ?? "…"}</p>
            <p className="text-sm text-muted-foreground">{p?.profile.email ?? ""}</p>
          </div>
          <Badge variant={p?.ai_enabled ? "success" : "secondary"} className="gap-1.5">
            <BrainCircuit className="h-3.5 w-3.5" />
            {p?.ai_enabled ? t("profile.aiConnected") : t("profile.aiDemo")}
          </Badge>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat icon={BookOpen} label={t("dash.stat.courses")} value={p?.summary.course_count} />
        <Stat icon={Network} label={t("dash.stat.nodes")} value={p?.summary.node_count} />
        <Stat icon={CheckCircle2} label={t("dash.stat.mastered")} value={p?.summary.mastered_count} />
        <Stat icon={RefreshCcw} label={t("dash.stat.review")} value={p?.summary.review_count} />
      </div>

      {/* Overall progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.overall")}</CardTitle>
          <CardDescription>{t("profile.overallDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={p?.summary.overall_progress ?? 0} className="h-3 flex-1" />
            <span className="text-lg font-semibold">{p?.summary.overall_progress ?? 0}%</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 课程掌握概览 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profile.courseOverview")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {courses.loading && <Skeleton className="h-12 w-full" />}
            {!courses.loading && courses.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">还没有课程。</p>
            )}
            {courses.data?.map((c) => (
              <Link key={c.id} href={`/courses/${c.id}`} className="block rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.stats.progress}%</span>
                </div>
                <Progress value={c.stats.progress} className="mt-2" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  已掌握 {c.stats.mastered_count} / {c.stats.node_count} · 待复习 {c.stats.review_count}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 待复习 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profile.reviewQueue")}</CardTitle>
            <CardDescription>{t("profile.reviewQueueDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.loading && <Skeleton className="h-9 w-full" />}
            {!profile.loading && p?.review_nodes.length === 0 && (
              <p className="text-sm text-muted-foreground">暂无待复习知识点。</p>
            )}
            {p?.review_nodes.map((n) => (
              <Link key={n.id} href={`/courses/${n.course_id}/graph?node=${n.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50">
                <span className="truncate">{n.name}</span>
                <MasteryBadge status="review" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 学习记录 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t("profile.records")}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-1">
            {profile.loading && <Skeleton className="h-12 w-full" />}
            {!profile.loading && p?.recent_records.length === 0 && (
              <EmptyState icon={FileText} title="暂无学习记录" />
            )}
            {p?.recent_records.slice(0, 10).map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {ACTION_LABEL[r.action_type] ?? r.action_type}
                    {r.node_name ? `：${r.node_name}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 历史测验 */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t("profile.quizzes")}</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.loading && <Skeleton className="h-12 w-full" />}
            {!profile.loading && p?.recent_attempts.length === 0 && (
              <EmptyState icon={ClipboardCheck} title="暂无测验记录" />
            )}
            {p?.recent_attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.quiz_title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(a.created_at)}</p>
                </div>
                <Badge variant={a.score >= 80 ? "success" : a.score >= 60 ? "warning" : "destructive"}>{a.score} 分</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 说明 */}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        {t("profile.footnote")}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number | undefined }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xl font-semibold">{value ?? 0}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
