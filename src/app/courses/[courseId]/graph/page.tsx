"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Search, Plus, Link2, Network, Waypoints } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { api } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseNav } from "@/components/course-nav";
import { KnowledgeNodeView } from "@/components/graph/knowledge-node";
import { NodeDetailPanel } from "@/components/graph/node-detail";
import { computeLayout } from "@/components/graph/layout";
import { MasteryLegend } from "@/components/mastery";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import type { GraphData, RelationType } from "@/lib/types";

const nodeTypes = { knowledge: KnowledgeNodeView };

const RELATION_META: Record<RelationType, { labelKey: I18nKey; color: string; dash: string | undefined }> = {
  prerequisite: { labelKey: "graph.rel.prerequisite", color: "#4C7FE0", dash: undefined },
  related: { labelKey: "graph.rel.related", color: "#98A1B0", dash: "6 4" },
  contains: { labelKey: "graph.rel.contains", color: "#3FA37C", dash: undefined },
  example_of: { labelKey: "graph.rel.example_of", color: "#D8A34A", dash: "2 4" },
};

export default function GraphPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const { data, loading, reload } = useFetch<GraphData>(`/api/courses/${courseId}/graph`);
  const { t } = useI18n();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chapter, setChapter] = useState("");
  const [relation, setRelation] = useState("");
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addEdgeOpen, setAddEdgeOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // add node form
  const [nName, setNName] = useState("");
  const [nDef, setNDef] = useState("");
  const [nDetail, setNDetail] = useState("");
  const [nChapter, setNChapter] = useState("");
  const [nDiff, setNDiff] = useState("3");
  // add edge form
  const [eSource, setESource] = useState("");
  const [eTarget, setETarget] = useState("");
  const [eType, setEType] = useState<RelationType>("prerequisite");

  // 自动选中 URL 参数指定的节点
  useEffect(() => {
    const node = searchParams.get("node");
    if (node) setSelected(node);
  }, [searchParams]);

  const chapters = useMemo(() => {
    const set = new Set<string>();
    for (const n of data?.nodes ?? []) if (n.chapter) set.add(n.chapter);
    return [...set].sort((a, b) => a.localeCompare(b, "zh"));
  }, [data]);

  // 过滤节点
  const filteredNodes = useMemo(() => {
    let nodes = data?.nodes ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      nodes = nodes.filter((n) => n.name.toLowerCase().includes(q));
    }
    if (chapter) nodes = nodes.filter((n) => n.chapter === chapter);
    return nodes;
  }, [data, search, chapter]);

  const visibleIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  // 过滤边
  const filteredEdges = useMemo(() => {
    let edges = data?.edges ?? [];
    if (relation) edges = edges.filter((e) => e.relation_type === relation);
    return edges.filter((e) => visibleIds.has(e.source_node_id) && visibleIds.has(e.target_node_id));
  }, [data, relation, visibleIds]);

  const neighborIds = useMemo(() => {
    const s = new Set<string>();
    if (!selected) return s;
    for (const e of data?.edges ?? []) {
      if (e.source_node_id === selected) s.add(e.target_node_id);
      if (e.target_node_id === selected) s.add(e.source_node_id);
    }
    return s;
  }, [selected, data]);

  // 布局（仅使用前置关系边）
  const positions = useMemo(() => {
    const prereqEdges = (data?.edges ?? []).filter(
      (e) => e.relation_type === "prerequisite" && visibleIds.has(e.source_node_id) && visibleIds.has(e.target_node_id)
    );
    return computeLayout(filteredNodes, prereqEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, visibleIds]);

  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<Node>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const rebuild = useCallback(() => {
    const dim = (id: string) => Boolean(selected) && id !== selected && !neighborIds.has(id);
    const nodes: Node[] = filteredNodes.map((n) => {
      const p = positions.get(n.id) ?? { x: 0, y: 0 };
      return {
        id: n.id,
        type: "knowledge",
        position: p,
        data: { label: n.name, mastery: n.mastery_status, difficulty: n.difficulty, dimmed: dim(n.id), selected: n.id === selected },
      };
    });
    const edges: Edge[] = filteredEdges.map((e) => {
      const meta = RELATION_META[e.relation_type];
      return {
        id: e.id,
        source: e.source_node_id,
        target: e.target_node_id,
        label: t(meta.labelKey),
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, color: meta.color, width: 16, height: 16 },
        style: { stroke: meta.color, strokeWidth: 1.75, strokeDasharray: meta.dash },
        labelStyle: { fill: meta.color, fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: "hsl(var(--card))", fillOpacity: 0.9 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        animated: false,
        opacity: selected && !neighborIds.has(e.source_node_id) && !neighborIds.has(e.target_node_id) ? 0.15 : 1,
      };
    });
    setRfNodes(nodes);
    setRfEdges(edges);
  }, [filteredNodes, filteredEdges, positions, selected, neighborIds, setRfNodes, setRfEdges, t]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  async function createNode() {
    if (!nName.trim()) return toast({ title: "请输入知识点名称", variant: "error" });
    setSaving(true);
    try {
      await api.post(`/api/courses/${courseId}/nodes`, {
        name: nName,
        definition: nDef,
        detail: nDetail,
        chapter: nChapter,
        difficulty: Number(nDiff),
      });
      toast({ title: "知识点已添加", variant: "success" });
      setAddNodeOpen(false);
      setNName(""); setNDef(""); setNDetail(""); setNChapter("");
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "添加失败", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function createEdge() {
    if (!eSource || !eTarget) return toast({ title: "请选择源节点与目标节点", variant: "error" });
    if (eSource === eTarget) return toast({ title: "源与目标不能相同", variant: "error" });
    setSaving(true);
    try {
      await api.post(`/api/courses/${courseId}/edges`, {
        source_node_id: eSource,
        target_node_id: eTarget,
        relation_type: eType,
      });
      toast({ title: "关系已添加", variant: "success" });
      setAddEdgeOpen(false);
      setESource(""); setETarget("");
      reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "添加失败", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const nodeOptions = (data?.nodes ?? []).map((n) => ({ value: n.id, label: n.name }));

  return (
    <div className="space-y-4">
      <CourseNav courseId={courseId} />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("graph.searchPlaceholder")} className="pl-8" />
        </div>
        <Select value={chapter} onChange={setChapter} options={chapters.map((c) => ({ value: c, label: c }))} placeholder={t("graph.chapter")} className="w-44" />
        <Select
          value={relation}
          onChange={setRelation}
          options={(Object.keys(RELATION_META) as RelationType[]).map((r) => ({ value: r, label: t(RELATION_META[r].labelKey) }))}
          placeholder={t("graph.relation")}
          className="w-36"
        />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => setAddNodeOpen(true)}>
            <Plus className="h-4 w-4" /> {t("graph.addNode")}
          </Button>
          <Button variant="outline" onClick={() => setAddEdgeOpen(true)}>
            <Link2 className="h-4 w-4" /> {t("graph.addEdge")}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <MasteryLegend />
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(Object.keys(RELATION_META) as RelationType[]).map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4" style={{ background: RELATION_META[r].color }} />
              {t(RELATION_META[r].labelKey)}
            </span>
          ))}
        </div>
      </div>

      {/* Canvas + Detail */}
      <div className="relative overflow-hidden rounded-xl border bg-background">
        {loading && <Skeleton className="h-[68vh] w-full rounded-none" />}
        {!loading && (
          <div className="h-[68vh]">
            {filteredNodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Network className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {data?.nodes.length === 0 ? t("graph.noNodes") : t("graph.noMatch")}
                </p>
              </div>
            ) : (
              <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelected(node.id)}
                onPaneClick={() => setSelected(null)}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.3}
                maxZoom={2}
                nodesDraggable
                nodesConnectable={false}
                proOptions={{ hideAttribution: false }}
              >
                <Background gap={20} size={1} />
                <Controls showInteractive={false} />
                <MiniMap
                  pannable
                  zoomable
                  nodeColor={(n) => {
                    const d = n.data as { mastery: string };
                    const map: Record<string, string> = { mastered: "#4C9EEB", learning: "#E8A33D", review: "#E0706B", untouched: "#98A1B0" };
                    return map[d.mastery] ?? "#98A1B0";
                  }}
                  className="!rounded-lg"
                />
              </ReactFlow>
            )}
          </div>
        )}

        {/* 详情面板 */}
        {selected && (
          <div className="absolute inset-y-0 right-0 z-10 w-full max-w-[360px] shadow-2xl">
            <NodeDetailPanel
              nodeId={selected}
              courseId={courseId}
              onClose={() => setSelected(null)}
              onSelect={setSelected}
              onChanged={reload}
            />
          </div>
        )}
      </div>

      {/* Add node modal */}
      <Modal open={addNodeOpen} onClose={() => setAddNodeOpen(false)} title={t("graph.addNodeTitle")} description={t("graph.addNodeDesc")}>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>{t("graph.nodeName")}</Label><Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder={t("graph.nodeName")} /></div>
          <div className="space-y-1.5"><Label>{t("graph.definition")}</Label><Textarea value={nDef} onChange={(e) => setNDef(e.target.value)} rows={2} /></div>
          <div className="space-y-1.5"><Label>{t("graph.detail")}</Label><Textarea value={nDetail} onChange={(e) => setNDetail(e.target.value)} rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t("graph.chapterLabel")}</Label><Input value={nChapter} onChange={(e) => setNChapter(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t("graph.difficulty")}</Label><Select value={nDiff} onChange={setNDiff} options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `${"●".repeat(d)}` }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddNodeOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={createNode} disabled={saving}>{saving && <Spinner />}{t("common.create")}</Button>
          </div>
        </div>
      </Modal>

      {/* Add edge modal */}
      <Modal open={addEdgeOpen} onClose={() => setAddEdgeOpen(false)} title={t("graph.addEdgeTitle")} description={t("graph.addEdgeDesc")}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("graph.source")}</Label>
            <Select value={eSource} onChange={setESource} options={nodeOptions} placeholder={t("graph.source")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("graph.target")}</Label>
            <Select value={eTarget} onChange={setETarget} options={nodeOptions} placeholder={t("graph.target")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("graph.relationType")}</Label>
            <Select value={eType} onChange={(v) => setEType(v as RelationType)} options={(Object.keys(RELATION_META) as RelationType[]).map((r) => ({ value: r, label: t(RELATION_META[r].labelKey) }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAddEdgeOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={createEdge} disabled={saving}>{saving && <Spinner />}{t("common.create")}</Button>
          </div>
        </div>
      </Modal>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Waypoints className="h-3.5 w-3.5" />
        {t("graph.hint")}
      </div>
    </div>
  );
}
