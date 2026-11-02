# 知序 Zhixu

**AI-Powered Knowledge Graph & Learning Companion**

> 让知识从碎片变成体系，让学习从被动接受变成主动探索。

> **当前版本：v2.2.0** — 版本记录见 [CHANGELOG.md](CHANGELOG.md)

知序是一款以 **AI 知识图谱** 为核心的个性化学习平台。它把零散的课程资料（PDF / DOCX / PPTX / TXT / Markdown）转化为可视化、可探索、可追溯的知识体系，并通过知识盲区诊断与个性化学习路径，帮助学生真正理解知识点之间的联系。

---

## 目录

- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [快速开始（本地运行）](#快速开始本地运行)
- [AI 模型配置](#ai-模型配置)
- [演示模式说明](#演示模式说明)
- [项目结构](#项目结构)
- [数据库设计](#数据库设计)
- [部署上线（路线 A：持久卷）](#部署上线路线-a持久卷)
- [部署到 Supabase + Vercel（路线 B）](#部署到-supabase--vercel路线-b)
- [更新日志](#更新日志)
- [API 接口概览](#api-接口概览)
- [已实现功能](#已实现功能)
- [未实现 / 待完善](#未实现--待完善)
- [已知问题与后续优化](#已知问题与后续优化)

---

## 核心功能

| 模块 | 说明 |
| --- | --- |
| **课程管理与资料上传** | 创建/编辑/删除课程；上传 PDF、DOCX、PPTX、TXT、Markdown；**上传立即返回、后台异步解析**，页面自动轮询进度（等待处理 / 正在解析 / 正在提取知识 / 已完成 / 处理失败）；自动保留章节与页码、分块存储 |
| **AI 知识图谱生成** | 提取知识点与关系（定义、章节、难度、来源、前置/相关/包含/实例关系）；结构化 JSON 保存；知识点去重；默认标记为「待确认」；支持手动增删改 |
| **交互式知识图谱** | React Flow 画布：节点拖动、缩放、平移、搜索、按章节/关系筛选、关联高亮、前置知识查看、分层布局；蓝色=已掌握、黄色=学习中、红色=需复习、灰色=未学习；点击节点查看详情面板 |
| **AI 个性化学习助手** | 基于课程资料的 RAG 问答，标注来源文件与页码；知识点讲解（通俗/详细/举例/类比/代码）；苏格拉底式引导；相关知识图谱跳转 |
| **知识盲区诊断与测验** | 单选/多选/判断/简答/代码题；每题关联知识点；判分后给出解析与可能误解；更新掌握状态 |
| **个性化学习路径** | 依据前置关系拓扑排序生成学习顺序；已掌握知识点自动跳过；进度记录与完成反馈 |

---

## 技术栈

- **前端**：Next.js 15（App Router）、React 19、TypeScript、Tailwind CSS、shadcn 风格组件、`@xyflow/react`（React Flow）、Lucide 图标
- **后端**：Next.js Route Handlers（Node.js runtime）
- **数据库**：
  - 本地开发：**SQLite**（Node 24 内置 `node:sqlite`，零原生依赖）
  - 生产（路线 A）：**SQLite + 持久卷**，通过 `DATA_DIR` 指向挂载卷，几乎零改造即可上线
  - 生产（路线 B，规模化）：**Supabase / PostgreSQL**（迁移 SQL 见 `supabase/migrations/`）
- **部署**：Docker（见 [`Dockerfile`](Dockerfile)）+ 任意支持常驻进程与持久卷的平台（Railway / Render / Fly.io 等）
- **AI**：OpenAI-compatible 接口（可配置任意供应商），服务端调用，结构化输出 + zod 校验，内置演示引擎兜底
- **文档解析**：`unpdf`（PDF）、`mammoth`（DOCX）、`jszip`（PPTX）

---

## 快速开始（本地运行）

### 环境要求

- Node.js ≥ 22.5（推荐 24，内置 `node:sqlite`）
- npm（或 pnpm / yarn）

### 步骤

```bash
# 1. 安装依赖
npm install
# （使用 pnpm 亦可：pnpm install）

# 2.（可选）配置 AI 模型，见下方「AI 模型配置」
#   不配置也能运行，会自动进入「演示模式」

# 3. 启动开发服务器
npm run dev
```

打开 <http://localhost:3000> 即可使用。首次访问会跳转到登录页，可使用内置演示账号：

- **邮箱**：`demo@zhixu.app`
- **密码**：`demo123`

也可以点击「注册」创建自己的账号。首次启动会自动建表并写入一门 **演示课程「C 语言程序设计」**（含知识图谱、测验、学习记录、学习路径），让你开箱即可体验完整流程。

### 常用命令

```bash
npm run dev        # 开发服务器（自动编译，改代码即时生效）
npm run build      # 生产构建
npm start          # 运行生产构建（需先 npm run build）
npm run typecheck  # TypeScript 类型检查
npm run lint       # ESLint
```

> ⚠️ **不要同时运行 `npm run dev` 和 `npm start`**：两者共用同一个 `.next` 目录，
> dev 模式会把它重写成开发产物，正在运行的生产服务器随即找不到自己的构建文件，
> 表现为**页面能显示但所有静态资源 400、按钮全部失效、报错 `client-side exception`**。
>
> 切换运行方式时请按顺序操作：
> 1. 停掉当前服务器（`Ctrl + C`）
> 2. 删除 `.next`
> 3. 按需执行 `npm run dev`，或 `npm run build` 后再 `npm start`
>
> 同理，**服务器运行期间不要执行 `npm run build`**。

### 体验完整流程

1. 打开首页，进入「C 语言程序设计」课程。
2. 点击「知识图谱」，拖动/缩放/点击节点查看详情。
3. 进入「AI 导师」提问，例如 *「malloc 和 free 的作用是什么？」*。
4. 进入「测验」生成并作答一份测验，提交后查看掌握状态变化。
5. 进入「学习路径」，选择目标知识点「动态内存分配」，查看自动推导的学习顺序。
6. 在课程详情页「上传资料」上传任意 PDF，观察解析与知识提取结果。

---

## 用户登录与账号

知序内置**本地账号体系**，开箱即用、无需任何外部服务：

- 注册 / 登录 / 退出登录，密码使用 Node 内置 `scrypt` 加盐哈希存储
- 基于 httpOnly Cookie 的会话（30 天有效期），中间件统一拦截未登录请求
- 所有课程、资料、知识图谱、学习记录按用户隔离（互不可见）
- 每个用户可在「设置」页配置自己的 AI 模型（互不干扰）

> 生产环境可平滑升级到 **Supabase Auth**：`profiles` 表已按 `auth.users(id)` 设计，只需替换认证层与数据访问适配器（详见「部署到 Supabase + Vercel」）。

---

## AI 模型配置

配置方式有**两种**，优先级从高到低：

1. **界面配置（推荐）**：登录后进入「设置」页，填写 API Key、接口地址、模型，保存后立即生效，按用户隔离存储。
2. **环境变量**：复制 `.env.example` 为 `.env.local` 并填写：

```env
# OpenAI-compatible 接口（可换成任意兼容服务商）
AI_API_KEY=sk-xxxx
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
# 可选：知识抽取使用更快/更便宜的模型
AI_EXTRACT_MODEL=
# 可选：单次回复最大输出 token。推理类模型会先消耗大量 token 思考，
# 若 AI 导师偶尔降级为演示模式，可调大此项（默认 8192）
AI_MAX_TOKENS=8192
# 可选：结构化 JSON 调用（知识抽取）的最大输出 token（默认 16000）
AI_EXTRACT_MAX_TOKENS=16000
# 可选：单次请求超时毫秒数（默认 300000）
AI_TIMEOUT_MS=300000
# 可选：429 / 5xx / 网络错误的重试次数（默认 2）
AI_MAX_RETRIES=2
# 可选：设为 1 时禁止 Base URL 指向本机/内网（防 SSRF）；用 Ollama 时保持 0
AI_BLOCK_PRIVATE_BASE_URL=0
```

上传与后台处理相关（可选）：

```env
# 上传大小上限（MB，默认 100）
MAX_UPLOAD_SIZE_MB=100
# 单个文档的后台处理超时（毫秒，默认 1800000 = 30 分钟）
# 超时后该文档标记失败、队列继续处理下一个，避免永久卡住
DOC_PROCESS_TIMEOUT_MS=1800000
# 数据目录：部署时指向持久卷（本地默认 ./data）
DATA_DIR=/data
```

支持任意 **OpenAI-compatible** 服务（OpenAI、DeepSeek、Moonshot、通义千问、本地 Ollama 等），只需修改 `AI_BASE_URL` 与 `AI_MODEL`。模型调用全部在服务端完成。

### 接入细节与安全

- **API Key 不会返回前端**：设置页只展示「是否已配置」与掩码预览（如 `sk-…abcd`），接口从不下发完整 Key。
- **连接自检**：设置页提供「测试连接」按钮，会实际调用一次模型接口，返回耗时或具体错误（Key 无效 / Base URL 错误 / 模型不存在 / 限流等）。
- **自动重试**：429、5xx 与网络错误会自动指数退避重试（默认 2 次）。
- **参数兼容**：部分新版模型要求 `max_completion_tokens` 而非 `max_tokens`，会自动改用该参数重试。
- **失败可见**：AI 调用失败降级演示引擎时，资料卡片会显示黄色提示，不再静默降级。
- **Base URL 校验**：必须是 `http(s)://` 开头的完整地址；多用户部署可设置 `AI_BLOCK_PRIVATE_BASE_URL=1` 阻止指向内网（防 SSRF）。
- ⚠️ **Key 的存储**：用户级 Key 以明文保存在本地 SQLite（`user_settings` 表）。本地自托管可接受；若部署给多人使用，建议只通过环境变量注入 Key，或对数据库做加密与访问控制。

### 各能力的 AI 行为

| 能力 | 有 Key | 无 Key（演示模式） |
| --- | --- | --- |
| 知识抽取 | LLM 结构化输出（zod 校验） | 内置术语表启发式抽取，界面标注「演示引擎」 |
| AI 导师 | RAG 检索 + LLM 生成 | 关键词检索 + 模板回复，明确标注非大模型 |
| 出题 | LLM 出题 | 规则出题，标注「演示引擎」 |

---

## 演示模式说明

**演示模式不是伪装的假数据。** 当未配置 `AI_API_KEY` 时：

- 知识抽取使用**内置术语表 + 共现关系**的确定性规则引擎，所有产出 `verified=false`（待确认）、低置信度，并在界面明确标注。
- AI 导师回复由**关键词检索 + 模板**生成，并在回复末尾声明「由演示规则引擎生成」。
- 内置演示课程的知识图谱为**手工编写**的示例数据，用于展示产品形态，不代表真实 AI 分析。

配置 `AI_API_KEY` 后，以上能力自动切换为真实大模型。

---

## 项目结构

```
zhixu/
├── src/
│   ├── app/                      # App Router 页面 + API
│   │   ├── page.tsx              # 首页 Dashboard
│   │   ├── courses/              # 课程管理 + 课程详情
│   │   ├── courses/[courseId]/   # graph / tutor / quiz / path
│   │   ├── profile/              # 学习中心
│   │   └── api/                  # Route Handlers
│   ├── components/
│   │   ├── ui/                   # 基础 UI 组件（shadcn 风格）
│   │   ├── layout/               # 应用外壳 / 侧边栏 / 主题
│   │   └── graph/                # 知识图谱（布局、节点、详情）
│   └── lib/
│       ├── types.ts              # 领域类型
│       ├── db/                   # SQLite 驱动、Schema、仓储、种子数据
│       ├── ai/                   # Provider、Schema、演示引擎
│       ├── parser/               # 文档解析（PDF/DOCX/PPTX/TXT/MD）
│       ├── services/             # 知识/检索/掌握度/学习路径/导师/测验/文档流水线
│       └── client.ts             # 客户端 API 封装
├── supabase/
│   └── migrations/               # PostgreSQL 迁移 + RLS + pgvector
├── data/                         # 运行时生成（SQLite 数据库、上传文件）
├── .env.example                  # 环境变量示例
└── README.md
```

---

## 数据库设计

14 张表：`profiles`、`courses`、`documents`、`document_chunks`、`knowledge_nodes`、`knowledge_edges`、`learning_records`、`quizzes`、`quiz_questions`、`quiz_attempts`、`learning_paths`、`learning_path_items`、`chat_sessions`、`chat_messages`。

- 主键全部使用 UUID
- 合理外键与索引
- `created_at` / `updated_at`
- 课程归属 `owner_id`，配合 **Row Level Security** 确保用户只能访问自己的课程与私有资料

完整 SQL 见 [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)，向量检索见 [`0002_vector.sql`](supabase/migrations/0002_vector.sql)。

---

## 部署上线（路线 A：持久卷）

适合团队 / 小规模使用：**保持 SQLite + 本地文件存储**，只需把数据目录挂到持久卷，几乎零改造即可上线。
完整步骤见 [`DEPLOY.md`](DEPLOY.md)，核心就三步：

1. 用 [`Dockerfile`](Dockerfile) 构建镜像（或让平台自动识别）
2. 挂载持久卷到 `/data`，并设置 `DATA_DIR=/data`
3. 配置 AI 环境变量，生成公网域名

```bash
docker build -t zhixu .
docker run -d -p 3000:3000 -v zhixu-data:/data -e DATA_DIR=/data \
  -e AI_BASE_URL=https://api.deepseek.com -e AI_MODEL=deepseek-chat -e AI_API_KEY=sk-xxxx zhixu
```

> 文档处理已改为**后台异步**：上传接口立即返回，后台按队列解析并提取知识，前端轮询状态；
> 进程重启后会自动恢复上次未完成的文档任务。
>
> 平台推荐：Railway / Render / Fly.io（均支持常驻进程 + 持久卷）。

## 部署到 Supabase + Vercel（路线 B）

用户规模变大、需要多实例横向扩展时再走这条路线（改造成本较高，需替换数据层与文件存储）：

1. 在 Supabase 创建项目，在 SQL Editor 中执行 `supabase/migrations/0001_init.sql`（可选再执行 `0002_vector.sql`）。
2. 配置 Supabase Storage 用于文件存储。
3. 在 Vercel 部署本项目，配置环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
AI_API_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

> 说明：当前代码的本地数据访问层以 SQLite 为运行时存储。路线 B 需将 `src/lib/db/repo.ts` 替换为基于 Supabase Client 的实现（Schema 与迁移 SQL 已完全对齐，可无缝替换），文件上传改为 Supabase Storage，并补齐后台任务队列（Serverless 环境下进程不常驻）。

---

## API 接口概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/courses` | 课程列表 / 创建 |
| GET/PATCH/DELETE | `/api/courses/:id` | 课程详情 / 更新 / 删除 |
| GET | `/api/courses/:id/graph` | 知识图谱（节点+关系） |
| GET/POST | `/api/courses/:id/documents` | 资料列表 / 上传（**立即返回，后台异步处理**） |
| POST/DELETE | `/api/documents/:id` | 重新处理 / 删除 |
| GET/POST | `/api/courses/:id/nodes` | 节点列表 / 手动新增 |
| GET/PATCH/DELETE | `/api/nodes/:id` | 节点详情 / 更新 / 删除 |
| POST/DELETE | `/api/courses/:id/edges` | 新增 / 删除关系 |
| GET/POST | `/api/courses/:id/chat` | 会话列表 / 提问 |
| GET | `/api/chat/:sessionId` | 会话消息 |
| GET/POST | `/api/courses/:id/quiz` | 测验列表 / 生成 |
| GET/POST | `/api/quiz/:id` | 测验内容 / 提交判分 |
| GET/POST | `/api/courses/:id/path` | 最新路径 / 生成 |
| GET/PATCH | `/api/path/:id` | 路径详情 / 更新进度 |
| GET | `/api/profile` | 个人学习全景 |

---

## 已实现功能

- ✅ 课程增删改查、课程卡片与统计
- ✅ 资料上传（PDF/DOCX/PPTX/TXT/MD）与解析状态流转、重新处理、删除
- ✅ 解析质量可见：可翻页查看实际提取的文本分块（含页码/章节）
- ✅ 上传健壮性：MIME 缺失按扩展名兜底、重复上传检测（409）、扫描版 PDF 文本过少警告、GBK 文本自动识别
- ✅ 后台队列可靠性：单文档超时 + 看门狗 + 排队位置提示，避免大文件阻塞
- ✅ **后台异步文档处理**：上传立即返回，后台队列解析与抽取，前端自动轮询进度，进程崩溃后可恢复
- ✅ **生产部署支持**：`DATA_DIR` 持久卷、Dockerfile、Railway/Render/Fly 部署文档
- ✅ **中文 bigram + BM25 检索**（改善中文分词与关键词召回）
- ✅ AI 知识提取（LLM 结构化输出 + 演示引擎兜底）、去重、待确认标记
- ✅ 交互式知识图谱（React Flow：拖动/缩放/平移/搜索/筛选/高亮/分层布局/详情面板/手动增删）
- ✅ 掌握状态四色视觉规范与可解释规则评分
- ✅ AI 导师 RAG 问答（来源标注 + 知识节点推荐 + 会话历史）
- ✅ 五类题型测验、判分、解析、掌握度联动
- ✅ 基于前置关系的个性化学习路径（已掌握自动跳过）
- ✅ 首页 Dashboard 与个人学习中心
- ✅ 深浅色主题、响应式布局
- ✅ 本地账号体系：注册/登录/登出、密码加盐哈希、Cookie 会话、中间件登录拦截、数据按用户隔离
- ✅ 界面化 AI 配置（设置页，按用户覆盖环境变量，支持任意 OpenAI-compatible 服务）
- ✅ Supabase 迁移 SQL + RLS + pgvector
- ✅ TypeScript 类型检查、ESLint、生产构建

## 未实现 / 待完善

- ⏳ Supabase Auth（当前为本地账号体系；生产可平滑替换，`profiles` 已按 `auth.users` 设计）
- ⏳ 生产环境 Supabase 数据访问适配器（Schema 已就绪）
- ⏳ 文件上传接入 Supabase Storage
- ⏳ pgvector 向量检索的运行时接入（当前为中文 bigram + BM25 关键词检索，迁移已备）
- ⏳ 间隔重复复习（SM-2）与错题本（已评估为高价值，尚未实现）
- ⏳ 知识关系的图内批量审核界面（当前支持单点编辑）
- ⏳ DOCX/PPTX 的页码信息（DOCX 无分页信息，PPTX 以幻灯片号为页）

## 已知问题与后续优化

- **本地 SQLite 与生产 PostgreSQL 的差异**：本地使用 `node:sqlite`（同步 API），生产需替换为 Supabase 客户端实现。可通过引入统一仓储接口进一步抽象。
- **大文件解析占用 CPU**：解析 1000+ 页 PDF 时会短暂占用事件循环，期间其他请求可能变慢；多人并发上传场景建议把解析放入 worker 线程。
- **跨语言检索**：中文提问对英文教材的分块检索命中较弱（可用知识节点上下文兜底）；接入向量检索后可解决。
- **关键词检索的局限**：已用中文 bigram + BM25 明显改善分词与召回，但对同义词/语义匹配仍弱，部署 pgvector 后可进一步提升。
- **掌握度评分**：当前为透明规则评分，后续可结合答题难度加权、重复测试表现、遗忘曲线（间隔重复）进一步优化。
- **图表性能**：知识点规模很大时（>500 节点）React Flow 渲染需引入虚拟化与增量布局。

---

## 更新日志

各版本的关键变化如下，详细记录见 [CHANGELOG.md](CHANGELOG.md)。

| 版本 | 主要变化 |
| --- | --- |
| **v2.2.0** | AI 接入安全加固（Key 掩码、Base URL 校验、重试、兼容 `max_completion_tokens`/`temperature`、测试连接）；文档上传健壮性（队列并发+超时+看门狗、排队提示、MIME 兜底、重复上传检测、GBK 识别、扫描件警告、查看解析内容、流式写盘）；抽取模型回退链修复；轮询不再闪烁 |
| v2.1.0 | 后台异步文档处理（进度轮询 + 崩溃恢复）、`DATA_DIR` 持久卷部署、Docker 部署文档、中文 bigram + BM25 检索、AI 导师推理模型 token 修复 |
| v2.0.2 | 修复测验页客户端渲染异常（`useSearchParams` 缺 Suspense） |
| v2.0.1 | 修复登录重定向死循环（失效 Cookie 导致） |
| v2.0.0 | 用户登录/注册、界面化 AI 配置、分批知识提取、中英文切换、黑白灰主题 |
| v1.0.0 | 首个版本：课程管理、资料解析、知识图谱、AI 导师、测验、学习路径 |

---

## License

仅用于学习与演示。课程资料默认为用户私有数据，请勿上传敏感信息。
