"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MASTERY_META } from "@/components/mastery";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { MasteryStatus } from "@/lib/types";

export type KnowledgeNodeData = {
  label: string;
  mastery: MasteryStatus;
  difficulty: number;
  dimmed: boolean;
  selected: boolean;
};

export function KnowledgeNodeView({ data, selected }: NodeProps) {
  const nodeData = data as unknown as KnowledgeNodeData;
  const meta = MASTERY_META[nodeData.mastery];
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "group relative w-[168px] rounded-lg border bg-card px-3 py-2.5 text-card-foreground shadow-sm transition-all",
        nodeData.dimmed && "opacity-30",
        selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      )}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-2 !bg-background" />
      <div className="flex items-center gap-1.5">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
        <span className="truncate text-[13px] font-medium leading-tight">{nodeData.label}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{t(meta.labelKey)}</span>
        <span>{t("graph.difficulty")} {"●".repeat(nodeData.difficulty)}{"○".repeat(5 - nodeData.difficulty)}</span>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-2 !bg-background" />
    </div>
  );
}
