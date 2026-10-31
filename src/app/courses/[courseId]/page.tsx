"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Network,
  MessageSquare,
  ClipboardCheck,
  Map,
  Upload,
  FileText,
  Trash2,
  RefreshCcw,
  Pencil,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { api, upload as uploadFile } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseNav } from "@/components/course-nav";
import { MasteryDot, MASTERY_META } from "@/components/mastery";
import { EmptyState } from "@/components/empty-state";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatBytes } from "@/lib/utils";
import type { CourseWithStats, Document, KnowledgeNode, MasteryStatus } from "@/lib/types";

const DOC_STATUS: Record<Document["status"], { labelKey: I18nKey; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  pending: { labelKey: "doc.pending", variant: "outline" },
  parsing: { labelKey: "doc.parsing", variant: "warning" },
  extracting: { labelKey: "doc.extracting", variant: "warning" },
  completed: { labelKey: "doc.completed", variant: "success" },
  failed: { labelKey: "doc.failed", variant: "destructive" },
};

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const { t } = useI18n();
  const course = useFetch<CourseWithStats>(`/api/courses/${courseId}`);
  const documents = useFetch<Document[]>(`/api/courses/${courseId}/documents`);
  const nodes = useFetch<KnowledgeNode[]>(`/api/courses/${courseId}/nodes`);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const res = await uploadFile<{ extraction: { node_count: number; edge_count: number; mode: string } }>(
        `/api/courses/${courseId}/documents`,
        file
      );
      toast({
        title: "资料解析完成",
        description: `提取 ${res.extraction.node_count} 个知识点、${res.extraction.edge_count} 条关系${res.extraction.mode === "demo" ? "（演示引擎）" : ""}`,
        variant: "success",
      });
      documents.reload();
      course.reload();
      nodes.reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "上传失败", variant: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openEdit() {
    setName(course.data?.name ?? "");
    setDesc(course.data?.description ?? "");
    setEditOpen(true);
  }
  async function saveEdit() {
    if (!name.trim()) return toast({ title: "请输入课程名称", variant: "error" });
    setSaving(true);
    try {
      await api.patch(`/api/courses/${courseId}`, { name, description: desc });
      toast({ title: "课程已更新", variant: "success" });
      setEditOpen(false);
      course.reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "保存失败", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function removeDoc(id: string) {
    try {
      await api.del(`/api/documents/${id}`);
      toast({ title: "资料已删除", variant: "success" });
      documents.reload();
      course.reload();
      nodes.reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "删除失败", variant: "error" });
    }
  }
  async function reprocess(id: string) {
    setReprocessing(id);
    try {
      await api.post(`/api/documents/${id}`);
      toast({ title: "已重新处理", variant: "success" });
      documents.reload();
      course.reload();
      nodes.reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "处理失败", variant: "error" });
    } finally {
      setReprocessing(null);
    }
  }

  const c = course.data;
  const breakdown = buildBreakdown(nodes.data ?? []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/courses" className="text-xs text-muted-foreground hover:text-foreground">{t("nav.courses")}</Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c?.name ?? "…"}</h1>
            <Button variant="ghost" size="icon" onClick={openEdit} aria-label="编辑">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          {c?.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{c.description}</p>}
        </div>
      </div>

      <CourseNav courseId={courseId} />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAction href={`/courses/${courseId}/graph`} icon={Network} title={t("course.stat.graph")} desc={t("course.stat.graphDesc")} />
        <QuickAction href={`/courses/${courseId}/tutor`} icon={MessageSquare} title={t("course.stat.tutor")} desc={t("course.stat.tutorDesc")} />
        <QuickAction href={`/courses/${courseId}/quiz`} icon={ClipboardCheck} title={t("course.stat.quiz")} desc={t("course.stat.quizDesc")} />
        <QuickAction href={`/courses/${courseId}/path`} icon={Map} title={t("course.stat.path")} desc={t("course.stat.pathDesc")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* 资料管理 */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle>{t("course.materials")}</CardTitle>
              <CardDescription>{t("course.materialsDesc")}</CardDescription>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner /> : <Upload className="h-4 w-4" />}
              {t("course.upload")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {documents.loading && <Skeleton className="h-16 w-full" />}
            {!documents.loading && documents.data?.length === 0 && (
              <EmptyState icon={FileText} title={t("course.noMaterials")} description={t("course.noMaterialsDesc")} />
            )}
            {documents.data?.map((d) => {
              const st = DOC_STATUS[d.status];
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(d.size_bytes)}
                      {d.page_count ? ` · ${d.page_count} 页` : ""}
                      {d.chunk_count ? ` · ${d.chunk_count} 分块` : ""}
                      {" · "}
                      {formatDate(d.created_at)}
                    </p>
                    {d.status === "failed" && d.parse_error && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {d.parse_error}
                      </p>
                    )}
                  </div>
                  <Badge variant={st.variant}>{t(st.labelKey)}</Badge>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => reprocess(d.id)} disabled={reprocessing === d.id} aria-label="重新处理">
                      {reprocessing === d.id ? <Spinner /> : <RefreshCcw className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeDoc(d.id)} aria-label="删除">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 学习进度 */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("course.progressTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("course.overall")}</span>
                  <span className="font-semibold">{c?.stats.progress ?? 0}%</span>
                </div>
                <Progress value={c?.stats.progress ?? 0} className="mt-2 h-2.5" />
              </div>
              <div className="space-y-2">
                {(Object.keys(MASTERY_META) as MasteryStatus[]).map((s) => {
                  const count = breakdown[s] ?? 0;
                  const total = nodes.data?.length ?? 0;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2 text-sm">
                      <MasteryDot status={s} />
                      <span className="w-14 text-muted-foreground">{t(MASTERY_META[s].labelKey)}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div className={`h-2 rounded-full ${MASTERY_META[s].dot}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-xs text-muted-foreground">{count}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">{t("course.nodesTitle")}</CardTitle>
              <Link href={`/courses/${courseId}/graph`} className="text-sm font-medium text-primary hover:underline">
                {t("course.enterGraph")}
              </Link>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {nodes.data?.slice(0, 8).map((n) => (
                <Link
                  key={n.id}
                  href={`/courses/${courseId}/graph?node=${n.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <MasteryDot status={n.mastery_status} />
                  <span className="flex-1 truncate">{n.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
              {(nodes.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">{t("course.noNodes")}</p>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t("course.editTitle")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>课程名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>课程简介</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving && <Spinner />}保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function QuickAction({ href, icon: Icon, title, desc }: { href: string; icon: typeof Network; title: string; desc: string }) {
  return (
    <Link href={href} className="group rounded-xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}

function buildBreakdown(nodes: KnowledgeNode[]): Record<MasteryStatus, number> {
  const r: Record<MasteryStatus, number> = { mastered: 0, learning: 0, review: 0, untouched: 0 };
  for (const n of nodes) r[n.mastery_status] = (r[n.mastery_status] ?? 0) + 1;
  return r;
}
