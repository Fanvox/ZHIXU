// 学习路径服务 —— 路径完全由知识图谱中的前置关系（prerequisite 边）决定，
// AI 仅负责解释与辅助，不臆造学习顺序。
import {
  listEdges,
  listNodes,
  getNode,
  createPath,
  addPathItem,
  latestPathFor,
  getPath,
  listPathItems,
} from "../db/repo";
import type { KnowledgeEdge, KnowledgeNode, LearningPathView, PathStep } from "../types";

// prerequisite 边语义：source 是 target 的前置知识（先学 source，再学 target）
export function buildPrerequisiteMap(edges: KnowledgeEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>(); // target -> [source...]
  for (const e of edges) {
    if (e.relation_type !== "prerequisite") continue;
    const list = map.get(e.target_node_id) ?? [];
    list.push(e.source_node_id);
    map.set(e.target_node_id, list);
  }
  return map;
}

/** 收集目标节点的全部祖先（递归前置）。 */
function collectAncestors(
  target: string,
  prereqOf: Map<string, string[]>
): Set<string> {
  const stack = [target];
  const ancestors = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    const prereqs = prereqOf.get(cur) ?? [];
    for (const p of prereqs) {
      if (!ancestors.has(p) && p !== target) {
        ancestors.add(p);
        stack.push(p);
      }
    }
  }
  return ancestors;
}

/** 对子图做拓扑排序，保证前置知识排在其依赖之前。 */
function topoSort(subgraph: Set<string>, prereqOf: Map<string, string[]>): string[] {
  const indegree = new Map<string, number>();
  for (const n of subgraph) indegree.set(n, 0);
  const adj = new Map<string, string[]>(); // source -> [targets]
  for (const n of subgraph) adj.set(n, []);
  for (const target of subgraph) {
    for (const src of prereqOf.get(target) ?? []) {
      if (subgraph.has(src)) {
        indegree.set(target, (indegree.get(target) ?? 0) + 1);
        adj.get(src)!.push(target);
      }
    }
  }
  const queue: string[] = [];
  for (const [n, d] of indegree) if (d === 0) queue.push(n);
  queue.sort();
  const order: string[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    order.push(cur);
    const next = (adj.get(cur) ?? []).slice().sort();
    for (const t of next) {
      indegree.set(t, indegree.get(t)! - 1);
      if (indegree.get(t) === 0) queue.push(t);
    }
    queue.sort();
  }
  return order;
}

export interface GeneratedPath {
  steps: PathStep[];
  demo: boolean;
}

/** 根据目标知识点生成学习路径步骤（不落库）。 */
export function generatePathSteps(
  courseId: string,
  targetNodeId: string
): GeneratedPath {
  const edges = listEdges(courseId);
  const nodes = listNodes(courseId);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const prereqOf = buildPrerequisiteMap(edges);

  const ancestors = collectAncestors(targetNodeId, prereqOf);
  const subgraph = new Set([targetNodeId, ...ancestors]);
  const order = topoSort(subgraph, prereqOf);

  const steps: PathStep[] = order.map((id) => {
    const n = nodeById.get(id);
    const skip = n?.mastery_status === "mastered";
    return {
      node_id: id,
      node_name: n?.name ?? "未知知识点",
      chapter: n?.chapter ?? null,
      difficulty: n?.difficulty ?? 3,
      mastery_status: n?.mastery_status ?? "untouched",
      reason: id === targetNodeId ? "target" : "prerequisite",
      skip,
    };
  });

  return { steps, demo: false };
}

/** 生成并持久化学习路径，返回 path id。 */
export function createLearningPath(
  courseId: string,
  userId: string,
  targetNodeId: string
): string {
  const { steps } = generatePathSteps(courseId, targetNodeId);
  const path = createPath(courseId, userId, targetNodeId);
  steps.forEach((s, i) => {
    addPathItem({
      path_id: path.id,
      node_id: s.node_id,
      order_index: i,
      status: s.skip ? "skipped" : "pending",
    });
  });
  return path.id;
}

export function getOrCreateLatestPath(
  courseId: string,
  targetNodeId: string,
  userId: string
): { pathId: string; created: boolean } {
  const existing = latestPathFor(courseId, userId);
  if (existing && existing.target_node_id === targetNodeId) {
    return { pathId: existing.id, created: false };
  }
  return { pathId: createLearningPath(courseId, userId, targetNodeId), created: true };
}

export function getTargetNode(targetNodeId: string): KnowledgeNode | undefined {
  return getNode(targetNodeId);
}

/** 组装学习路径视图（含节点名与掌握状态）。 */
export function getPathView(pathId: string): LearningPathView | null {
  const path = getPath(pathId);
  if (!path) return null;
  const target = getNode(path.target_node_id);
  const items = listPathItems(pathId);
  const view = {
    id: path.id,
    target_node_id: path.target_node_id,
    target_node_name: target?.name ?? "未知知识点",
    status: path.status as LearningPathView["status"],
    items: items.map((it) => {
      const n = getNode(it.node_id);
      return {
        id: it.id,
        node_id: it.node_id,
        node_name: n?.name ?? "未知知识点",
        chapter: n?.chapter ?? null,
        difficulty: n?.difficulty ?? 3,
        mastery_status: n?.mastery_status ?? "untouched",
        status: it.status as LearningPathView["items"][number]["status"],
        order_index: it.order_index,
        completed_at: it.completed_at,
        skipped: it.status === "skipped",
      };
    }),
  };
  return view;
}
