// 演示引擎 —— 当未配置 AI API Key 时使用的确定性规则引擎。
// 重要：本引擎的输出为「启发式/演示」结果，界面会明确标注，绝不冒充真实 AI 分析。
import type {
  KnowledgeExtraction,
  QuizGeneration,
  QuizQuestion as QuizQuestionSchemaType,
} from "./schemas";
import type { KnowledgeNode, KnowledgeEdge, SourceRef } from "../types";

interface GlossaryTerm {
  term: string;
  definition: string;
  difficulty: number;
}

// 常用程序设计/计算机基础术语表（用于启发式知识抽取）
const GLOSSARY: GlossaryTerm[] = [
  { term: "变量", definition: "用于存储数据、具有名字和类型的存储单元。", difficulty: 1 },
  { term: "数据类型", definition: "决定变量占用内存大小与可执行运算的类型，如 int、float、char。", difficulty: 1 },
  { term: "运算符", definition: "对操作数进行运算的符号，如 +、-、*、/、%、=。", difficulty: 1 },
  { term: "表达式", definition: "由运算符和操作数组成的可求值式子。", difficulty: 1 },
  { term: "控制流程", definition: "程序按条件选择执行路径或重复执行代码的结构。", difficulty: 2 },
  { term: "循环", definition: "让一段代码重复执行的结构，如 for、while。", difficulty: 2 },
  { term: "分支", definition: "根据条件选择执行不同代码路径的结构，如 if/else、switch。", difficulty: 2 },
  { term: "函数", definition: "完成特定功能、可重复调用的代码块。", difficulty: 2 },
  { term: "递归", definition: "函数直接或间接调用自身的编程技巧。", difficulty: 4 },
  { term: "数组", definition: "相同类型元素在内存中连续存储的数据结构。", difficulty: 2 },
  { term: "字符串", definition: "以空字符结尾的字符序列。", difficulty: 2 },
  { term: "指针", definition: "保存另一个变量内存地址的变量。", difficulty: 3 },
  { term: "内存地址", definition: "内存单元的编号，标识变量在内存中的位置。", difficulty: 3 },
  { term: "解引用", definition: "通过指针访问其指向的数据的操作，使用 * 运算符。", difficulty: 3 },
  { term: "指针运算", definition: "对指针进行加减运算，移动距离由所指向类型大小决定。", difficulty: 3 },
  { term: "结构体", definition: "把多个不同类型数据组合成一个整体的自定义类型。", difficulty: 3 },
  { term: "动态内存分配", definition: "程序运行时按需向堆申请内存的机制，如 malloc。", difficulty: 4 },
  { term: "malloc", definition: "在堆上分配指定字节内存并返回首地址的标准库函数。", difficulty: 4 },
  { term: "free", definition: "释放由 malloc 等函数分配的内存的标准库函数。", difficulty: 4 },
  { term: "内存泄漏", definition: "动态分配的内存未被释放且无法再访问的现象。", difficulty: 4 },
  { term: "悬空指针", definition: "指向已释放内存的指针，解引用会导致未定义行为。", difficulty: 4 },
  { term: "栈", definition: "由系统自动管理的内存区域，用于存放局部变量和函数调用。", difficulty: 3 },
  { term: "堆", definition: "由程序员手动管理的内存区域，用于动态内存分配。", difficulty: 4 },
  { term: "链表", definition: "由节点和指针链接而成的线性数据结构。", difficulty: 4 },
  { term: "二叉树", definition: "每个节点最多有两个子节点的树形数据结构。", difficulty: 4 },
  { term: "队列", definition: "先进先出（FIFO）的线性数据结构。", difficulty: 3 },
  { term: "排序", definition: "把一组数据按特定顺序排列的算法过程。", difficulty: 3 },
  { term: "查找", definition: "在数据集合中定位目标元素的算法过程。", difficulty: 3 },
  { term: "算法复杂度", definition: "衡量算法运行时间或空间随规模增长的度量。", difficulty: 4 },
  { term: "文件操作", definition: "通过标准库对磁盘文件进行打开、读写、关闭的操作。", difficulty: 3 },
  { term: "常量", definition: "程序运行期间值不可改变的量。", difficulty: 1 },
  { term: "作用域", definition: "变量在程序中可被访问的范围。", difficulty: 2 },
  { term: "传值调用", definition: "把实参的值复制给形参的调用方式，函数内修改不影响实参。", difficulty: 2 },
  { term: "传址调用", definition: "把实参的地址传给形参的调用方式，函数内可修改实参。", difficulty: 3 },
  { term: "编译", definition: "把源代码翻译为目标代码或机器码的过程。", difficulty: 2 },
  { term: "预处理", definition: "编译前对源代码进行宏展开、头文件包含等处理。", difficulty: 3 },
];

// 少量人工整理的前置关系（仅用于演示，标记为待确认）
const PREREQ_PAIRS: [string, string][] = [
  ["变量", "数据类型"],
  ["数据类型", "运算符"],
  ["变量", "数组"],
  ["数组", "字符串"],
  ["内存地址", "指针"],
  ["指针", "解引用"],
  ["指针", "指针运算"],
  ["指针", "动态内存分配"],
  ["动态内存分配", "内存泄漏"],
  ["动态内存分配", "free"],
  ["函数", "递归"],
  ["函数", "传值调用"],
  ["指针", "传址调用"],
];

function normalize(text: string): string {
  return text.toLowerCase();
}

function termInText(term: string, text: string): boolean {
  const t = text.toLowerCase();
  if (/^[a-z0-9_*&+\-]+$/i.test(term)) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`).test(t);
  }
  return t.includes(term.toLowerCase());
}

function bestSnippet(term: string, content: string): string | null {
  const sentences = content
    .split(/(?<=[。！？；.!?;])/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of sentences) {
    if (termInText(term, s)) return s.length > 500 ? s.slice(0, 500) + "…" : s;
  }
  const idx = content.toLowerCase().indexOf(term.toLowerCase());
  if (idx >= 0) {
    const start = Math.max(0, idx - 60);
    const end = Math.min(content.length, idx + 120);
    return (start > 0 ? "…" : "") + content.slice(start, end) + (end < content.length ? "…" : "");
  }
  return null;
}

interface DemoChunk {
  content: string;
  page_start: number | null;
  section: string | null;
}

/** 启发式知识抽取：基于术语表匹配与共现关系。 */
export function demoExtractKnowledge(chunks: DemoChunk[]): KnowledgeExtraction {
  const termHits = new Map<string, { count: number; snippet: string | null; page: number | null; section: string | null; def: string; difficulty: number }>();

  for (const chunk of chunks) {
    for (const g of GLOSSARY) {
      if (termInText(g.term, chunk.content)) {
        const existing = termHits.get(g.term);
        const snippet = bestSnippet(g.term, chunk.content);
        if (!existing) {
          termHits.set(g.term, {
            count: 1,
            snippet,
            page: chunk.page_start,
            section: chunk.section,
            def: g.definition,
            difficulty: g.difficulty,
          });
        } else {
          existing.count += 1;
          if (!existing.snippet && snippet) existing.snippet = snippet;
        }
      }
    }
  }

  const nodes = Array.from(termHits.entries()).map(([term, h]) => ({
    name: term,
    definition: h.def,
    detail: h.snippet ?? h.def,
    chapter: h.section ?? undefined,
    difficulty: h.difficulty,
    source_page: h.page ?? undefined,
  }));

  const names = new Set(nodes.map((n) => n.name));
  const edges: KnowledgeExtraction["edges"] = [];

  // 前置关系（来自人工整理，标记低置信度）
  for (const [from, to] of PREREQ_PAIRS) {
    if (names.has(from) && names.has(to)) {
      edges.push({
        source: from,
        target: to,
        relation_type: "prerequisite",
        evidence: "演示规则：内置术语关系表",
        confidence: 0.5,
      });
    }
  }

  // 共现关系：同一分块中出现即视为相关
  const cooccur = new Map<string, Set<string>>();
  for (const chunk of chunks) {
    const present: string[] = [];
    for (const g of GLOSSARY) {
      if (names.has(g.term) && termInText(g.term, chunk.content)) present.push(g.term);
    }
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        const [a, b] = present[i] < present[j] ? [present[i], present[j]] : [present[j], present[i]];
        if (!cooccur.has(a)) cooccur.set(a, new Set());
        if (!cooccur.get(a)!.has(b)) {
          cooccur.get(a)!.add(b);
          edges.push({
            source: a,
            target: b,
            relation_type: "related",
            evidence: "演示规则：同一分块共现",
            confidence: 0.4,
          });
        }
      }
    }
  }

  return { nodes, edges };
}

// ---------------- 演示问答（基于关键词检索） ----------------

export interface DemoAnswerContext {
  courseName: string;
  chunks: {
    id: string;
    document_id: string;
    document_name: string;
    content: string;
    page_start: number | null;
    section: string | null;
  }[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selectedNode: KnowledgeNode | null;
}

export interface DemoAnswer {
  content: string;
  sources: SourceRef[];
  nodeRefs: string[];
  demo: true;
}

function tokenize(text: string): string[] {
  const cjk = text.match(/[\u4e00-\u9fff]{2,}/g) ?? [];
  const ascii = (text.toLowerCase().match(/[a-z0-9_]+/g) ?? []).filter((w) => w.length >= 2);
  return [...cjk, ...ascii];
}

export function demoAnswer(question: string, ctx: DemoAnswerContext): DemoAnswer {
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) {
    return {
      content: "请提供更具体的问题，我可以结合课程资料为你解答。",
      sources: [],
      nodeRefs: [],
      demo: true,
    };
  }

  // ctx.chunks 已由 BM25 检索（searchChunks）排好序，直接沿用顺序；
  // 不再用旧的「重叠数 / √长度」二次打分，避免把已排序的结果打乱。
  const scored = ctx.chunks.slice(0, 3).map((c) => ({ c }));

  // 匹配相关知识节点
  const matchedNodes = ctx.nodes
    .filter((n) => {
      const nt = tokenize(n.name + " " + (n.definition ?? ""));
      return nt.some((t) => qTokens.has(t)) || qTokens.has(n.name.toLowerCase());
    })
    .slice(0, 4);

  const nodeRefs = matchedNodes.map((n) => n.id);

  if (scored.length === 0 && matchedNodes.length === 0) {
    return {
      content:
        "抱歉，在课程资料中我没有检索到与这个问题直接相关的内容。为避免误导，我不会用模型常识冒充课程内容。你可以换个问法，或先查看知识图谱中相关的知识点。",
      sources: [],
      nodeRefs: [],
      demo: true,
    };
  }

  const lines: string[] = [];

  if (matchedNodes.length > 0) {
    lines.push("根据课程知识图谱，与你的问题相关的知识点如下：");
    for (const n of matchedNodes.slice(0, 3)) {
      lines.push(`· **${n.name}**：${n.definition ?? ""}`);
    }
    lines.push("");
  }

  if (scored.length > 0) {
    lines.push("以下是课程资料中的相关内容（摘录）：");
    for (const { c } of scored) {
      const excerpt = c.content.length > 320 ? c.content.slice(0, 320) + "…" : c.content;
      lines.push(`> ${excerpt}`);
    }
  } else {
    lines.push("课程资料中没有找到更详细的原文，以上结论来自知识图谱中的知识点定义，仅供参考。");
  }

  if (ctx.selectedNode && !matchedNodes.some((n) => n.id === ctx.selectedNode!.id)) {
    lines.push("");
    lines.push(`你当前选中的知识点「${ctx.selectedNode.name}」也与上下文相关，可结合理解。`);
    if (!nodeRefs.includes(ctx.selectedNode.id)) nodeRefs.push(ctx.selectedNode.id);
  }

  const sources: SourceRef[] = scored.map(({ c }) => ({
    document_id: c.document_id,
    document_name: c.document_name,
    page: c.page_start,
    snippet: c.content.slice(0, 120),
  }));

  lines.push("");
  lines.push("（本回答由演示规则引擎生成，未使用大模型，仅供参考。）");

  return { content: lines.join("\n"), sources, nodeRefs, demo: true };
}

// ---------------- 演示测验生成 ----------------

export function demoGenerateQuiz(
  nodes: KnowledgeNode[],
  allNodes: KnowledgeNode[]
): QuizGeneration {
  const pool = nodes.length > 0 ? nodes : allNodes;
  const distractorPool = allNodes.filter((n) => !pool.some((p) => p.id === n.id));

  const questions: QuizQuestionSchemaType[] = [];
  for (const n of pool.slice(0, 6)) {
    const def = n.definition ?? n.detail ?? n.name;
    const distractors = distractorPool
      .filter((d) => d.definition)
      .slice(0, 3)
      .map((d) => d.definition!);
    if (distractors.length >= 2) {
      questions.push({
        type: "single",
        stem: `下列关于「${n.name}」的描述，正确的是？`,
        options: [def, ...distractors.slice(0, 3)],
        answer: "A",
        explanation: `正确答案是 A：${def}`,
        node_id: n.id,
        difficulty: n.difficulty,
      });
    }
    questions.push({
      type: "true_false",
      stem: `判断：「${n.name}」—— ${def}`,
      options: ["正确", "错误"],
      answer: "A",
      explanation: `该表述是对「${n.name}」的定义描述，因此正确。`,
      node_id: n.id,
      difficulty: n.difficulty,
    });
  }

  return { questions: questions.slice(0, 10) };
}

export { normalize };
