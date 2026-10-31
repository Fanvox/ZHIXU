// AI 导师服务 —— 基于课程资料的 RAG 问答 + 知识图谱引用。
// 未配置大模型时降级为演示规则引擎，并在回复中明确标注。
import { isAIEnabled, chatCompletion } from "../ai/provider";
import { demoAnswer } from "../ai/demo";
import { searchChunks, matchNodes } from "./retrieval";
import { listNodes, listEdges, getNode, getCourse } from "../db/repo";
import type { SourceRef } from "../types";

export interface TutorReply {
  content: string;
  sources: SourceRef[];
  nodeRefs: string[];
  mode: "ai" | "demo";
}

export async function tutorReply(
  courseId: string,
  question: string,
  selectedNodeId: string | null | undefined,
  userId: string
): Promise<TutorReply> {
  const course = getCourse(courseId);
  const nodes = listNodes(courseId);
  const edges = listEdges(courseId);
  const hits = searchChunks(courseId, question, 4);
  const nodeIds = matchNodes(courseId, question, 4);
  const selectedNode = selectedNodeId ? getNode(selectedNodeId) ?? null : null;
  if (selectedNode && !nodeIds.includes(selectedNode.id)) nodeIds.push(selectedNode.id);

  const sources: SourceRef[] = hits.map((h) => ({
    document_id: h.document_id,
    document_name: h.document_name,
    page: h.page_start,
    snippet: h.content.slice(0, 160),
  }));

  if (isAIEnabled(userId)) {
    const answer = await chatCompletion(userId, buildTutorMessages(course?.name ?? "", question, hits, nodes, nodeIds, selectedNode));
    if (answer) {
      return { content: answer, sources, nodeRefs: nodeIds, mode: "ai" };
    }
  }

  const demo = demoAnswer(question, {
    courseName: course?.name ?? "课程",
    chunks: hits.map((h) => ({
      id: h.chunk_id,
      document_id: h.document_id,
      document_name: h.document_name,
      content: h.content,
      page_start: h.page_start,
      section: h.section,
    })),
    nodes,
    edges,
    selectedNode,
  });

  return { content: demo.content, sources: demo.sources.length ? demo.sources : sources, nodeRefs: demo.nodeRefs.length ? demo.nodeRefs : nodeIds, mode: "demo" };
}

function buildTutorMessages(
  courseName: string,
  question: string,
  hits: { content: string; document_name: string; page_start: number | null; section: string | null }[],
  nodes: { id: string; name: string; definition: string | null; detail: string | null }[],
  nodeIds: string[],
  selectedNode: { name: string; definition: string | null; detail: string | null } | null
) {
  const contextParts: string[] = [];

  if (selectedNode) {
    contextParts.push(`当前选中的知识点：「${selectedNode.name}」\n定义：${selectedNode.definition ?? ""}\n解释：${selectedNode.detail ?? ""}`);
  }

  const relatedNodes = nodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean)
    .slice(0, 5);
  if (relatedNodes.length) {
    contextParts.push(
      "相关知识节点：\n" +
        relatedNodes.map((n) => `- ${n!.name}：${n!.definition ?? ""}`).join("\n")
    );
  }

  if (hits.length) {
    contextParts.push(
      "课程资料检索片段：\n" +
        hits
          .map((h) => `【${h.document_name}${h.page_start != null ? ` 第${h.page_start}页` : ""}】${h.content.slice(0, 800)}`)
          .join("\n\n")
    );
  }

  return [
    {
      role: "system" as const,
      content:
        `你是知序学习平台的 AI 导师，当前课程是「${courseName}」。请基于提供的课程资料与知识图谱回答学生问题。` +
        "规则：\n1. 优先依据资料内容回答，资料中没有的不要用模型常识冒充，明确说明资料中未找到。\n2. 尽量标注来源文件与页码。\n3. 适当采用通俗解释、类比或代码示例。\n4. 在不影响理解的前提下，可用苏格拉底式提问引导学生思考。\n5. 用简体中文，回答条理清晰。",
    },
    {
      role: "user" as const,
      content: `【课程上下文】\n${contextParts.join("\n\n") || "（无检索到上下文）"}\n\n【学生问题】\n${question}`,
    },
  ];
}
