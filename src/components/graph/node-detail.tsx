"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X,
  Trash2,
  BookOpen,
  FileText,
  Link2,
  GraduationCap,
  ClipboardCheck,
} from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MasteryBadge, MasteryDot } from "@/components/mastery";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { KnowledgeNode, MasteryStatus, RelationType } from "@/lib/types";

interface NodeDetail {
  node: KnowledgeNode;
  prerequisites: { node: KnowledgeNode; relation_type: RelationType; confidence: number }[];
  dependents: { node: KnowledgeNode; relation_type: RelationType; confidence: number }[];
  related: { node: KnowledgeNode; relation_type: RelationType; confidence: number }[];
  source: { document_id: string; document_name: string; page: number | null } | null;
}

export function NodeDetailPanel({
  nodeId,
  courseId,
  onClose,
  onSelect,
  onChanged,
}: {
  nodeId: string;
  courseId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const { data, loading, reload } = useFetch<NodeDetail>(`/api/nodes/${nodeId}`);
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function setMastery(status: MasteryStatus) {
    setSaving(true);
    try {
      await api.patch(`/api/nodes/${nodeId}`, { mastery_status: status });
      toast({ title: "掌握状态已更新", variant: "success" });
      reload();
      onChanged();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "更新失败", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function removeNode() {
    setDeleting(true);
    try {
      await api.del(`/api/nodes/${nodeId}`);
      toast({ title: "知识点已删除", variant: "success" });
      onClose();
      onChanged();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "删除失败", variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  const node = data?.node;

  return (
    <aside className="scrollbar-thin flex h-full flex-col overflow-y-auto border-l bg-card">
      <div className="sticky top-0 flex items-center justify-between border-b bg-card px-4 py-3">
        <span className="text-sm font-semibold">{t("graph.nodeDetail")}</span>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="space-y-3 p-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {!loading && node && (
        <div className="space-y-5 p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold leading-tight">{node.name}</h2>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MasteryBadge status={node.mastery_status} />
              <Badge variant="secondary">{t("graph.difficulty")} {"●".repeat(node.difficulty)}</Badge>
              {node.verified ? <Badge variant="success">{t("graph.verified")}</Badge> : <Badge variant="warning">{t("graph.unverified")}</Badge>}
            </div>
          </div>

          {node.chapter && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" /> {node.chapter}
            </p>
          )}

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("graph.definitionLabel")}</h3>
            <p className="text-sm leading-relaxed">{node.definition || "暂无定义"}</p>
          </div>

          {node.detail && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("graph.detailLabel")}</h3>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{node.detail}</p>
            </div>
          )}

          {/* 前置知识 */}
          {data.prerequisites.length > 0 && (
            <RelationList
              title={t("graph.prerequisites")}
              items={data.prerequisites}
              onSelect={onSelect}
              icon={<GraduationCap className="h-3.5 w-3.5" />}
            />
          )}

          {/* 后续知识 */}
          {data.dependents.length > 0 && (
            <RelationList
              title={t("graph.dependents")}
              items={data.dependents}
              onSelect={onSelect}
              icon={<Link2 className="h-3.5 w-3.5" />}
            />
          )}

          {/* 相关知识 */}
          {data.related.length > 0 && (
            <RelationList
              title={t("graph.relatedLabel")}
              items={data.related}
              onSelect={onSelect}
              icon={<Link2 className="h-3.5 w-3.5" />}
            />
          )}

          {/* 来源 */}
          {data.source && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> {t("graph.sourceLabel")}
              </h3>
              <p className="text-sm">{data.source.document_name}</p>
              {data.source.page != null && <p className="text-xs text-muted-foreground">{t("graph.page", { page: data.source.page })}</p>}
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("graph.learningStatus")}</h3>
            <Select
              value={node.mastery_status}
              onChange={(v) => setMastery(v as MasteryStatus)}
              options={[
                { value: "untouched", label: t("mastery.untouched") },
                { value: "learning", label: t("mastery.learning") },
                { value: "review", label: t("mastery.review") },
                { value: "mastered", label: t("mastery.mastered") },
              ]}
            />
            {saving && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Spinner /> {t("common.loading")}</p>}
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <Link
              href={`/courses/${courseId}/quiz?node=${nodeId}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ClipboardCheck className="h-4 w-4" /> {t("graph.exercises")}
            </Link>
            <Button variant="destructive" onClick={removeNode} disabled={deleting}>
              {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />} {t("graph.deleteNode")}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}

function RelationList({
  title,
  items,
  onSelect,
  icon,
}: {
  title: string;
  items: { node: KnowledgeNode; relation_type: RelationType; confidence: number }[];
  onSelect: (id: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h3>
      <div className="space-y-1.5">
        {items.map((it) => (
          <button
            key={it.node.id}
            onClick={() => onSelect(it.node.id)}
            className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
          >
            <MasteryDot status={it.node.mastery_status} />
            <span className="flex-1 truncate">{it.node.name}</span>
            <span className="text-[10px] text-muted-foreground">{Math.round(it.confidence * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
