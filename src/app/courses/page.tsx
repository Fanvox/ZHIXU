"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Network, BookOpen, FileText, Pencil, Trash2, ArrowRight } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils";
import type { CourseWithStats } from "@/lib/types";

export default function CoursesPage() {
  const { data, loading, reload } = useFetch<CourseWithStats[]>("/api/courses");
  const { t } = useI18n();
  const router = useRouter();
  const [modal, setModal] = useState<{ type: "create" | "edit"; course?: CourseWithStats } | null>(null);
  const [deleting, setDeleting] = useState<CourseWithStats | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  function openCreate() {
    setName("");
    setDesc("");
    setModal({ type: "create" });
  }
  function openEdit(course: CourseWithStats) {
    setName(course.name);
    setDesc(course.description ?? "");
    setModal({ type: "edit", course });
  }

  async function save() {
    if (!name.trim()) return toast({ title: "请输入课程名称", variant: "error" });
    setSaving(true);
    try {
      if (modal?.type === "create") {
        await api.post("/api/courses", { name, description: desc });
        toast({ title: "课程已创建", variant: "success" });
      } else if (modal?.course) {
        await api.patch(`/api/courses/${modal.course.id}`, { name, description: desc });
        toast({ title: "课程已更新", variant: "success" });
      }
      setModal(null);
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "保存失败", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await api.del(`/api/courses/${deleting.id}`);
      toast({ title: "课程已删除", variant: "success" });
      setDeleting(null);
      reload();
      router.refresh();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "删除失败", variant: "error" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("courses.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("courses.subtitle")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t("courses.new")}
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      )}

      {!loading && data?.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title={t("dash.noCourses")}
          description={t("dash.noCoursesDesc")}
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> {t("courses.new")}
            </Button>
          }
        />
      )}

      {!loading && data && data.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Card key={c.id} className="group relative overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/courses/${c.id}`} className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Network className="h-5 w-5" />
                      </div>
                      <h3 className="truncate font-semibold">{c.name}</h3>
                    </div>
                  </Link>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="编辑">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} aria-label="删除">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {c.description || t("courses.noDesc")}
                </p>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("courses.progress")}</span>
                    <span className="font-medium text-foreground">{c.stats.progress}%</span>
                  </div>
                  <Progress value={c.stats.progress} className="mt-1.5" />
                </div>

                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{c.stats.document_count} {t("courses.docs")}</span>
                  <span className="flex items-center gap-1"><Network className="h-3.5 w-3.5" />{c.stats.node_count} {t("courses.nodes")}</span>
                  <span className="ml-auto">{t("courses.updatedAt")} {formatDate(c.updated_at)}</span>
                </div>

                <Link href={`/courses/${c.id}`} className="mt-4 flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/50">
                  {t("courses.enter")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal?.type === "edit" ? t("courses.editTitle") : t("courses.createTitle")}
        description={t("courses.desc")}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("courses.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("courses.namePlaceholder")} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>{t("courses.desc")}</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("courses.descPlaceholder")} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>{t("common.cancel")}</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Spinner />}
              {modal?.type === "edit" ? t("common.save") : t("common.create")}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={deleting !== null} onClose={() => setDeleting(null)} title={t("courses.deleteTitle")}>
        <p className="text-sm text-muted-foreground">
          {t("courses.deleteConfirm", { name: deleting?.name ?? "" })}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleting(null)}>{t("common.cancel")}</Button>
          <Button variant="destructive" onClick={confirmDelete}>{t("common.delete")}</Button>
        </div>
      </Modal>
    </div>
  );
}
