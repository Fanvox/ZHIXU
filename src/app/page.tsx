"use client";

import Link from "next/link";
import {
  Network,
  BookOpen,
  CheckCircle2,
  RefreshCcw,
  ArrowRight,
  Sparkles,
  FileText,
  GraduationCap,
} from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MasteryBadge } from "@/components/mastery";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/utils";
import type { CourseWithStats } from "@/lib/types";

interface ProfileData {
  profile: { name: string };
  summary: { course_count: number; node_count: number; mastered_count: number; review_count: number; overall_progress: number };
  recent_records: { id: string; action_type: string; detail: string | null; created_at: string; node_name: string | null; course_id: string }[];
  recent_attempts: { id: string; score: number; created_at: string; quiz_title: string; course_id: string }[];
  review_nodes: { id: string; name: string; course_id: string }[];
}

function greeting(): I18nKey {
  const h = new Date().getHours();
  if (h < 6) return "greeting.night";
  if (h < 11) return "greeting.morning";
  if (h < 14) return "greeting.noon";
  if (h < 18) return "greeting.afternoon";
  return "greeting.evening";
}

const ACTION_LABEL: Record<string, string> = {
  quiz_correct: "答对测验题",
  quiz_wrong: "测验题答错",
  review: "复习了知识点",
  explain: "查看讲解",
  learn_complete: "完成学习",
};

export default function DashboardPage() {
  const profile = useFetch<ProfileData>("/api/profile");
  const courses = useFetch<CourseWithStats[]>("/api/courses");
  const { t } = useI18n();

  const firstCourse = courses.data?.[0];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-primary">{t(greeting())}，{profile.data?.profile.name ?? "同学"} 👋</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("dash.title")}</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              {t("dash.subtitle")}
            </p>
          </div>
          {firstCourse && (
            <Link
              href={`/courses/${firstCourse.id}/graph`}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <Network className="h-4 w-4" />
              {t("dash.enterGraph")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={BookOpen} label={t("dash.stat.courses")} value={courses.data?.length} loading={courses.loading} />
        <StatCard icon={Network} label={t("dash.stat.nodes")} value={profile.data?.summary.node_count} loading={profile.loading} />
        <StatCard icon={CheckCircle2} label={t("dash.stat.mastered")} value={profile.data?.summary.mastered_count} loading={profile.loading} accent="text-mastered" />
        <StatCard icon={RefreshCcw} label={t("dash.stat.review")} value={profile.data?.summary.review_count} loading={profile.loading} accent="text-review" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 当前课程 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>{t("dash.myCourses")}</CardTitle>
              <CardDescription>{t("dash.myCoursesDesc")}</CardDescription>
            </div>
            <Link href="/courses" className="text-sm font-medium text-primary hover:underline">
              {t("common.viewAll")}
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {courses.loading && <Skeleton className="h-20 w-full" />}
            {!courses.loading && courses.data?.length === 0 && (
              <EmptyState icon={BookOpen} title="还没有课程" description="创建第一门课程，开始构建你的知识体系。" action={<Link href="/courses" className="text-sm font-medium text-primary">去创建课程</Link>} />
            )}
            {courses.data?.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.id}`}
                className="flex items-center gap-4 rounded-xl border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Network className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{c.name}</p>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.stats.progress}%</span>
                  </div>
                  <Progress value={c.stats.progress} className="mt-2" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {c.stats.node_count} 个知识点 · {c.stats.mastered_count} 已掌握 · {c.stats.document_count} 份资料
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* 待复习 & 最近测验 */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">待复习知识点</CardTitle>
              <CardDescription>根据掌握情况推荐</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.loading && <Skeleton className="h-9 w-full" />}
              {!profile.loading && profile.data?.review_nodes.length === 0 && (
                <p className="text-sm text-muted-foreground">暂无待复习知识点，继续保持！</p>
              )}
              {profile.data?.review_nodes.map((n) => (
                <Link key={n.id} href={`/courses/${n.course_id}/graph?node=${n.id}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted/50">
                  <span className="truncate">{n.name}</span>
                  <MasteryBadge status="review" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近测验</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.loading && <Skeleton className="h-9 w-full" />}
              {!profile.loading && profile.data?.recent_attempts.length === 0 && (
                <p className="text-sm text-muted-foreground">还没有测验记录，去课程里测一测吧。</p>
              )}
              {profile.data?.recent_attempts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate">{a.quiz_title}</span>
                  <Badge variant={a.score >= 80 ? "success" : a.score >= 60 ? "warning" : "destructive"}>{a.score} 分</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 最近学习记录 */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>最近学习动态</CardTitle>
            <CardDescription>你的每一步学习都被记录下来</CardDescription>
          </div>
          <GraduationCap className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {profile.loading && <Skeleton className="h-12 w-full" />}
          {!profile.loading && profile.data?.recent_records.length === 0 && (
            <p className="text-sm text-muted-foreground">暂无学习记录。</p>
          )}
          {profile.data?.recent_records.slice(0, 6).map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {ACTION_LABEL[r.action_type] ?? r.action_type}
                  {r.node_name ? `：${r.node_name}` : ""}
                </p>
                {r.detail && <p className="truncate text-xs text-muted-foreground">{r.detail}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        知序会将你的每一次答题与复习，转化为知识图谱中的掌握状态。
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent,
}: {
  icon: typeof BookOpen;
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className={`text-xl font-semibold ${accent ?? ""}`}>
            {loading ? "–" : (value ?? 0)}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

