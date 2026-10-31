// 演示种子数据 —— 仅当数据库为空时写入，用于让应用开箱即可体验完整流程。
// 所有内容均为手工编写的演示课程，不代表真实 AI 分析结果。
import { migrate } from "./schema";
import {
  addChunks,
  addRecord,
  addQuestion,
  createCourse,
  createDocument,
  createEdge,
  createNode,
  createPath,
  addPathItem,
  createQuiz,
  getUserByEmail,
  createUser,
  getCourseStats,
  setMastery,
  updateDocumentStatus,
} from "./repo";
import { hashPassword } from "../auth";
import type { Difficulty, MasteryStatus, RelationType } from "../types";

interface SeedNode {
  key: string;
  name: string;
  definition: string;
  detail: string;
  chapter: string;
  difficulty: Difficulty;
  mastery: MasteryStatus;
  page: number;
}

const NODES: SeedNode[] = [
  {
    key: "var",
    name: "变量与数据类型",
    definition: "变量是用于存储数据、具有名字和类型的存储单元；数据类型决定了变量占用内存的大小与可执行的运算。",
    detail:
      "C 语言是强类型语言，变量必须先声明后使用。基本类型包括整型（int、short、long）、浮点型（float、double）和字符型（char）。声明变量时编译器会为其分配内存空间，类型决定了空间大小和取值范围。理解变量是理解内存和指针的前提。",
    chapter: "第 1 章 · C 语言基础",
    difficulty: 1,
    mastery: "mastered",
    page: 12,
  },
  {
    key: "operator",
    name: "运算符与表达式",
    definition: "运算符是对操作数进行运算的符号，表达式是由运算符和操作数组成的、可求值的式子。",
    detail:
      "C 语言提供算术、关系、逻辑、赋值、位运算等运算符，并有明确的优先级和结合性。赋值运算符把右侧表达式的值写入左侧变量的内存中，这是理解变量存储值的具体体现。",
    chapter: "第 1 章 · C 语言基础",
    difficulty: 1,
    mastery: "mastered",
    page: 24,
  },
  {
    key: "control",
    name: "控制流程（分支与循环）",
    definition: "控制流程指程序按条件选择执行路径或重复执行某段代码的结构，包括 if/else、switch、for、while。",
    detail:
      "分支结构让程序根据条件选择执行路径；循环结构让一段代码重复执行。它们是算法表达的基本工具，也是后续理解递归、函数调用流程的基础。",
    chapter: "第 2 章 · 程序控制结构",
    difficulty: 2,
    mastery: "mastered",
    page: 38,
  },
  {
    key: "function",
    name: "函数",
    definition: "函数是完成特定功能、可重复调用的代码块，通过参数接收输入、通过返回值输出结果。",
    detail:
      "C 程序由函数组成，main 是入口函数。函数调用涉及参数的传递（按值传递）与栈帧的创建。理解函数调用机制是理解指针传参（传址调用）与递归的关键。",
    chapter: "第 3 章 · 函数",
    difficulty: 2,
    mastery: "learning",
    page: 55,
  },
  {
    key: "array",
    name: "数组",
    definition: "数组是一组相同类型元素在内存中连续存储的数据结构，通过下标访问元素。",
    detail:
      "数组元素在内存中是连续排列的，数组名在大多数表达式中会退化为指向首元素的指针，这为后续学习指针与数组的关系埋下伏笔。",
    chapter: "第 4 章 · 数组与字符串",
    difficulty: 2,
    mastery: "mastered",
    page: 71,
  },
  {
    key: "string",
    name: "字符串",
    definition: "字符串是以空字符 '\\0' 结尾的字符数组，C 语言通过字符数组或字符指针来存储字符串。",
    detail:
      "C 语言没有内建的字符串类型，字符串本质是字符数组。标准库 <string.h> 提供 strlen、strcpy、strcmp 等操作函数，这些函数内部都依赖指针来遍历字符。",
    chapter: "第 4 章 · 数组与字符串",
    difficulty: 2,
    mastery: "learning",
    page: 84,
  },
  {
    key: "addr",
    name: "内存地址",
    definition: "内存地址是内存单元的编号，每个字节拥有唯一地址；取地址运算符 & 可以取得变量的地址。",
    detail:
      "程序运行时，每个变量都占据一段内存，地址标识了它在内存中的位置。理解地址是理解指针的先决条件：指针本质就是保存地址的变量。",
    chapter: "第 5 章 · 指针",
    difficulty: 3,
    mastery: "learning",
    page: 98,
  },
  {
    key: "pointer",
    name: "指针的基本概念",
    definition: "指针是保存另一个变量内存地址的变量，通过解引用运算符 * 可以访问其指向的数据。",
    detail:
      "定义指针时要指定其指向的类型，如 int *p 表示 p 是一个指向 int 的指针。p 保存地址，*p 表示该地址处的值。指针与普通变量的核心区别在于它保存的是地址而非数值。",
    chapter: "第 5 章 · 指针",
    difficulty: 3,
    mastery: "learning",
    page: 101,
  },
  {
    key: "ptr_array",
    name: "指针与数组",
    definition: "数组名可视为指向首元素地址的常量指针，指针的加减运算与数组下标访问具有对应关系。",
    detail:
      "a[i] 与 *(a + i) 等价：下标运算本质上是指针偏移后解引用。指针可以指向数组元素并遍历数组，这是 C 语言中指针最常见的用法之一。",
    chapter: "第 5 章 · 指针",
    difficulty: 3,
    mastery: "untouched",
    page: 115,
  },
  {
    key: "ptr_func",
    name: "指针与函数（传址调用）",
    definition: "通过向函数传递指针参数，函数可以修改调用者变量本身，这种方式称为传址调用。",
    detail:
      "C 语言默认按值传递，形参是实参的副本，函数内修改形参不会影响实参。要修改调用者的变量，需要传递其地址（指针），函数通过解引用修改原值，例如交换两个变量的 swap 函数。",
    chapter: "第 5 章 · 指针",
    difficulty: 3,
    mastery: "untouched",
    page: 128,
  },
  {
    key: "struct",
    name: "结构体",
    definition: "结构体是把多个不同类型的数据组合成一个整体的一种自定义数据类型。",
    detail:
      "struct 关键字定义结构体，通过 . 访问成员。结构体让相关的数据打包在一起，是构建链表、树等复杂数据结构的基础。",
    chapter: "第 6 章 · 结构体与内存管理",
    difficulty: 3,
    mastery: "untouched",
    page: 142,
  },
  {
    key: "ptr_mem",
    name: "指针与内存操作",
    definition: "利用指针可以读写任意合法内存区域的内容，对指针的赋值和运算直接操作内存。",
    detail:
      "指针加 1 移动的距离等于其所指向类型的大小。对未初始化或越界指针进行解引用是危险的未定义行为。正确使用指针操作内存是进行动态内存分配的基础。",
    chapter: "第 6 章 · 结构体与内存管理",
    difficulty: 3,
    mastery: "untouched",
    page: 155,
  },
  {
    key: "malloc",
    name: "动态内存分配（malloc/free）",
    definition: "动态内存分配指程序在运行时通过 malloc 等函数向堆申请内存、通过 free 释放内存的机制。",
    detail:
      "malloc(size) 在堆上分配 size 字节并返回首地址（void*），需要强制类型转换；free(ptr) 释放该内存。动态内存大小可在运行时决定，解决了数组大小固定和栈空间有限的问题，但要求开发者手动管理内存生命周期。",
    chapter: "第 6 章 · 结构体与内存管理",
    difficulty: 4,
    mastery: "untouched",
    page: 168,
  },
  {
    key: "leak",
    name: "内存泄漏与内存管理",
    definition: "内存泄漏指动态分配的内存未被释放且无法再访问，导致程序占用的内存不断增长。",
    detail:
      "忘记调用 free、丢失指针、重复释放或释放后继续使用（悬空指针）都是常见内存管理错误。良好的内存管理纪律是：谁分配谁释放，释放后置 NULL。",
    chapter: "第 6 章 · 结构体与内存管理",
    difficulty: 4,
    mastery: "review",
    page: 179,
  },
  {
    key: "file",
    name: "文件操作",
    definition: "文件操作通过 FILE* 指针和标准库函数对磁盘文件进行打开、读写、关闭。",
    detail:
      "fopen、fread、fwrite、fclose 等函数以 FILE* 为核心句柄，文件指针也是指针概念在 I/O 中的具体应用。",
    chapter: "第 7 章 · 文件操作",
    difficulty: 3,
    mastery: "untouched",
    page: 193,
  },
  {
    key: "malloc_usage",
    name: "malloc 用法",
    definition: "malloc 函数的典型用法：p = (int*)malloc(n * sizeof(int)); 判断返回是否为空；使用后 free(p); p = NULL;",
    detail:
      "示例代码：\nint *p = (int*)malloc(10 * sizeof(int));\nif (p == NULL) { /* 分配失败处理 */ }\n/* 使用 p[0..9] */\nfree(p);\np = NULL;",
    chapter: "第 6 章 · 结构体与内存管理",
    difficulty: 4,
    mastery: "untouched",
    page: 170,
  },
  {
    key: "free_usage",
    name: "free 用法",
    definition: "free 函数释放由 malloc/calloc/realloc 分配的内存；只能释放一次，释放后应将指针置为 NULL 避免悬空指针。",
    detail:
      "free(ptr) 本身不会修改 ptr 的值，释放后 ptr 仍指向原地址（悬空指针），再次解引用或二次 free 会导致未定义行为。因此约定：free 后立即把指针置为 NULL。",
    chapter: "第 6 章 · 结构体与内存管理",
    difficulty: 4,
    mastery: "untouched",
    page: 172,
  },
];

interface SeedEdge {
  from: string;
  to: string;
  type: RelationType;
  evidence: string;
}

const EDGES: SeedEdge[] = [
  { from: "var", to: "operator", type: "prerequisite", evidence: "理解运算符需先理解变量与数据类型" },
  { from: "var", to: "control", type: "prerequisite", evidence: "控制流程依赖变量与表达式" },
  { from: "control", to: "function", type: "prerequisite", evidence: "理解函数调用流程需先掌握控制结构" },
  { from: "var", to: "array", type: "prerequisite", evidence: "数组是同类变量的连续集合" },
  { from: "array", to: "string", type: "prerequisite", evidence: "字符串本质是字符数组" },
  { from: "var", to: "addr", type: "prerequisite", evidence: "理解内存地址需先理解变量在内存中的存储" },
  { from: "addr", to: "pointer", type: "prerequisite", evidence: "指针就是保存地址的变量" },
  { from: "pointer", to: "ptr_array", type: "prerequisite", evidence: "指针与数组关系需先掌握指针概念" },
  { from: "array", to: "ptr_array", type: "related", evidence: "数组名退化为指针" },
  { from: "pointer", to: "ptr_func", type: "prerequisite", evidence: "传址调用以指针为基础" },
  { from: "ptr_array", to: "ptr_func", type: "related", evidence: "都是指针的应用场景" },
  { from: "pointer", to: "ptr_mem", type: "prerequisite", evidence: "指针内存操作以指针为基础" },
  { from: "ptr_mem", to: "malloc", type: "prerequisite", evidence: "动态内存分配需要指针操作内存" },
  { from: "malloc", to: "leak", type: "prerequisite", evidence: "理解内存泄漏需先理解动态内存分配" },
  { from: "struct", to: "ptr_mem", type: "related", evidence: "结构体常与指针结合使用" },
  { from: "string", to: "ptr_array", type: "related", evidence: "字符串与指针遍历密切相关" },
  { from: "malloc", to: "malloc_usage", type: "example_of", evidence: "malloc 用法的具体示例" },
  { from: "malloc", to: "free_usage", type: "example_of", evidence: "free 用法的具体示例" },
  { from: "function", to: "ptr_func", type: "related", evidence: "传址调用是函数与指针的结合" },
  { from: "file", to: "pointer", type: "related", evidence: "文件指针是指针的应用" },
];

const DOC_CHUNKS: { content: string; page: number; section: string }[] = [
  {
    section: "第 1 章 · C 语言基础",
    page: 12,
    content:
      "变量是程序中最基本的存储单元。在 C 语言中，变量必须先声明后使用，声明时需指定其数据类型。基本数据类型包括整型 int、浮点型 float/double 和字符型 char。数据类型决定了变量在内存中所占空间的大小以及可以执行的运算。例如 int 通常占 4 个字节，char 占 1 个字节。理解变量在内存中的存储方式，是后续学习指针和内存地址的重要基础。",
  },
  {
    section: "第 5 章 · 指针",
    page: 98,
    content:
      "程序运行时，每个变量都占据一段内存，内存中的每个字节都有一个唯一的地址。使用取地址运算符 & 可以获取变量的地址。指针就是专门用来保存地址的变量。定义一个指针时要指明它指向的类型，例如 int *p 表示 p 是一个指向 int 类型数据的指针。p 保存的是地址，*p 表示该地址处存放的值，这个过程称为解引用。",
  },
  {
    section: "第 5 章 · 指针",
    page: 115,
    content:
      "数组名在大多数表达式中会退化为指向数组首元素的指针。因此 a[i] 与 *(a+i) 是等价的：下标运算本质上是指针偏移后再解引用。理解这一点有助于理解指针与数组的紧密关系，也是掌握字符串遍历和指针运算的关键。",
  },
  {
    section: "第 6 章 · 结构体与内存管理",
    page: 168,
    content:
      "动态内存分配允许程序在运行时按需向堆申请内存。malloc(size) 函数在堆上分配 size 个字节并返回首地址，返回类型为 void*，使用前需进行强制类型转换。分配的内存不再使用时必须调用 free 函数释放，否则会造成内存泄漏。动态内存解决了数组大小固定和栈空间有限的问题，但要求程序员手动管理内存的生命周期。",
  },
  {
    section: "第 6 章 · 结构体与内存管理",
    page: 179,
    content:
      "内存泄漏指动态分配的内存没有被释放且无法再被访问，导致程序占用的内存持续增长。常见的内存管理错误包括：忘记调用 free、丢失指针、重复释放、以及释放后继续使用（悬空指针）。良好的内存管理习惯是：谁分配谁释放，并在 free 之后立即将指针置为 NULL。",
  },
];

export function seedIfEmpty(): void {
  migrate();
  if (getUserByEmail("demo@zhixu.app")) return;

  let profile = getUserByEmail("demo@zhixu.app");
  if (!profile) {
    profile = createUser("知序学习者", "demo@zhixu.app", hashPassword("demo123"));
  }
  const course = createCourse(
    "C 语言程序设计",
    "系统学习 C 语言，覆盖变量、控制结构、函数、数组、指针与动态内存管理等核心主题。",
    profile.id
  );

  // 演示文档 + 分块（用于追溯来源与检索问答）
  const doc = createDocument({
    course_id: course.id,
    filename: "C语言程序设计-课件.pdf",
    mime_type: "application/pdf",
    size_bytes: 482133,
  });
  addChunks(
    doc.id,
    DOC_CHUNKS.map((c) => ({
      content: c.content,
      page_start: c.page,
      page_end: c.page,
      section: c.section,
    }))
  );
  updateDocumentStatus(doc.id, "completed", {
    page_count: 210,
    chunk_count: DOC_CHUNKS.length,
  });

  // 知识节点
  const ids: Record<string, string> = {};
  for (const n of NODES) {
    const node = createNode({
      course_id: course.id,
      name: n.name,
      definition: n.definition,
      detail: n.detail,
      chapter: n.chapter,
      difficulty: n.difficulty,
      source_document_id: doc.id,
      source_page: n.page,
      confidence: 0.95,
      verified: true,
    });
    setMastery(node.id, n.mastery);
    ids[n.key] = node.id;
  }

  // 知识关系
  for (const e of EDGES) {
    createEdge({
      course_id: course.id,
      source_node_id: ids[e.from],
      target_node_id: ids[e.to],
      relation_type: e.type,
      evidence: e.evidence,
      confidence: 0.9,
      verified: true,
    });
  }

  // 测验
  const quizNodeIds = [ids.malloc, ids.pointer, ids.leak, ids.ptr_array, ids.addr];
  createCourseQuiz(course.id, quizNodeIds);

  // 学习记录
  addRecord({
    user_id: profile.id,
    course_id: course.id,
    node_id: ids.var,
    action_type: "quiz_correct",
    detail: "完成基础测验",
    score: 1,
  });
  addRecord({
    user_id: profile.id,
    course_id: course.id,
    node_id: ids.leak,
    action_type: "quiz_wrong",
    detail: "内存管理测验作答错误",
    score: 0,
  });
  addRecord({
    user_id: profile.id,
    course_id: course.id,
    node_id: ids.pointer,
    action_type: "explain",
    detail: "查看了指针的详细解释",
  });

  // 学习路径（目标：动态内存分配）
  const path = createPath(course.id, profile.id, ids.malloc);
  const order = ["var", "addr", "pointer", "ptr_mem", "malloc"];
  order.forEach((key, i) => {
    addPathItem({ path_id: path.id, node_id: ids[key], order_index: i, status: i === 0 ? "skipped" : "pending" });
  });

  void getCourseStats;
}

// 辅助：直接构造测验内容（避免在 seed 中依赖 AI 服务）
function createCourseQuiz(courseId: string, nodeIds: string[]): void {
  const quiz = createQuiz(courseId, "C 语言 · 指针与动态内存 摸底测验", nodeIds);
  const qs: {
    type: string;
    stem: string;
    options: string[];
    answer: string;
    explanation: string;
    node_id: string;
    difficulty: number;
  }[] = [
    {
      type: "single",
      stem: "下列哪个运算符用于获取变量的内存地址？",
      options: ["*", "&", "%", "#"],
      answer: "B",
      explanation: "取地址运算符 & 用于获取变量的内存地址；* 是解引用运算符。",
      node_id: nodeIds[1],
      difficulty: 2,
    },
    {
      type: "single",
      stem: "关于 malloc 函数，下列说法正确的是？",
      options: [
        "malloc 分配的内存在栈上",
        "malloc 返回 void* 类型指针",
        "malloc 分配的内存会自动释放",
        "malloc 不需要判断返回值",
      ],
      answer: "B",
      explanation: "malloc 在堆上分配内存，返回 void* 类型指针，使用前需强制类型转换并判断是否返回 NULL；分配的内存必须手动 free。",
      node_id: nodeIds[0],
      difficulty: 3,
    },
    {
      type: "multiple",
      stem: "以下哪些属于常见的内存管理错误？（多选）",
      options: ["忘记调用 free", "重复释放同一指针", "释放后继续使用（悬空指针）", "在函数内声明局部变量"],
      answer: "ABC",
      explanation: "忘记 free、重复释放、悬空指针都是动态内存管理常见错误；局部变量由栈自动管理，不属于内存泄漏。",
      node_id: nodeIds[2],
      difficulty: 3,
    },
    {
      type: "true_false",
      stem: "数组名在表达式中可以退化为指向首元素的指针。",
      options: ["正确", "错误"],
      answer: "A",
      explanation: "正确。数组名在大多数表达式中会退化为指向首元素地址的常量指针，因此 a[i] 与 *(a+i) 等价。",
      node_id: nodeIds[3],
      difficulty: 2,
    },
    {
      type: "code",
      stem: "阅读代码：int a = 5; int *p = &a; 执行 *p = 10; 后，变量 a 的值是多少？",
      options: [],
      answer: "10",
      explanation: "p 指向 a 的地址，*p 就是 a 本身，因此 *p = 10 相当于把 a 修改为 10。",
      node_id: nodeIds[1],
      difficulty: 2,
    },
  ];
  for (const q of qs) addQuestion({ quiz_id: quiz.id, ...q });
}
