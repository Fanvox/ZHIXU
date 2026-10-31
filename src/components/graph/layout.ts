// 知识图谱分层布局 —— 基于前置关系（prerequisite）做自左向右的拓扑分层，
// 前置知识在左、依赖知识在右，直观体现学习顺序。
import type { KnowledgeNode, KnowledgeEdge } from "@/lib/types";

export function computeLayout(
  nodes: KnowledgeNode[],
  edges: KnowledgeEdge[]
): Map<string, { x: number; y: number }> {
  const ids = new Set(nodes.map((n) => n.id));
  const nameById = new Map(nodes.map((n) => [n.id, n.name]));

  // 前置关系的反向邻接：target -> [sources]
  const pred = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, 0);
  for (const e of edges) {
    if (e.relation_type !== "prerequisite") continue;
    if (!ids.has(e.source_node_id) || !ids.has(e.target_node_id)) continue;
    if (!pred.has(e.target_node_id)) pred.set(e.target_node_id, []);
    pred.get(e.target_node_id)!.push(e.source_node_id);
    indeg.set(e.target_node_id, (indeg.get(e.target_node_id) ?? 0) + 1);
  }

  // Kahn 拓扑排序
  const queue = [...ids].filter((id) => (indeg.get(id) ?? 0) === 0);
  queue.sort();
  const order: string[] = [];
  const indegCopy = new Map(indeg);
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    for (const e of edges) {
      if (e.relation_type !== "prerequisite" || e.source_node_id !== cur) continue;
      const t = e.target_node_id;
      if (!ids.has(t)) continue;
      indegCopy.set(t, (indegCopy.get(t) ?? 1) - 1);
      if (indegCopy.get(t) === 0) queue.push(t);
    }
    queue.sort();
  }

  // 计算层级：layer = max(前置层级) + 1
  const layer = new Map<string, number>();
  for (const id of order) {
    let maxL = 0;
    for (const p of pred.get(id) ?? []) {
      maxL = Math.max(maxL, (layer.get(p) ?? 0) + 1);
    }
    layer.set(id, maxL);
  }
  for (const id of ids) if (!layer.has(id)) layer.set(id, 0);

  // 按层分组、按名称排序
  const byLayer = new Map<number, string[]>();
  for (const [id, l] of layer) {
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(id);
  }
  let maxRows = 0;
  for (const arr of byLayer.values()) {
    arr.sort((a, b) => (nameById.get(a) ?? "").localeCompare(nameById.get(b) ?? "", "zh"));
    maxRows = Math.max(maxRows, arr.length);
  }

  const layerWidth = 260;
  const rowHeight = 96;
  const positions = new Map<string, { x: number; y: number }>();
  for (const [l, idsInLayer] of byLayer) {
    const offset = ((maxRows - idsInLayer.length) * rowHeight) / 2;
    idsInLayer.forEach((id, i) => {
      positions.set(id, { x: l * layerWidth, y: offset + i * rowHeight });
    });
  }

  return positions;
}
