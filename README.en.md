# Zhixu

**AI-Powered Knowledge Graph & Learning Companion**

> Turn fragmented knowledge into a system, and turn passive acceptance into active exploration.

[简体中文](README.md) · **English** · [日本語](README.ja.md) · [한국어](README.ko.md)

> **Current version: v2.2.0** — see [CHANGELOG.md](CHANGELOG.md) for the version history

Zhixu is a personalized learning platform built around an **AI knowledge graph**. It turns scattered course materials (PDF / DOCX / PPTX / TXT / Markdown) into a visual, explorable, and traceable knowledge system, and — through blind-spot diagnosis and personalized learning paths — helps students truly understand how knowledge points connect.

---

## Table of Contents

- [Why Zhixu](#why-zhixu)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Quick Start (Local Development)](#quick-start-local-development)
- [AI Model Configuration](#ai-model-configuration)
- [Demo Mode](#demo-mode)
- [Project Structure](#project-structure)
- [Database Design](#database-design)
- [Deployment (Route A: Persistent Volume)](#deployment-route-a-persistent-volume)
- [Deploy to Supabase + Vercel (Route B)](#deploy-to-supabase--vercel-route-b)
- [Changelog](#changelog)
- [API Overview](#api-overview)
- [Implemented Features](#implemented-features)
- [Not Implemented / To Be Improved](#not-implemented--to-be-improved)
- [Known Issues & Future Optimizations](#known-issues--future-optimizations)

---

## Why Zhixu

> **Zhixu doesn't solve the problem of getting information; it solves the problem of organizing knowledge and making learning decisions.**

### A Real Student Scenario

Before finals, a student has 8 PDF slide decks, a textbook, and dozens of practice problems. They take one problem to an AI, and the AI quickly gives the correct answer — but the student still doesn't know: which prerequisite knowledge this problem relies on, which step exactly they failed to learn, or what to review next.

Traditional AI is good at answering "a single question", while what students really need is to understand "an entire course" and to know how to keep improving.

### The Core Pain Point: More Materials, More Fragmented Knowledge

| Problem | Manifestation |
| --- | --- |
| **Can't see the whole picture** | You've studied a lot, but you don't know how the knowledge points connect |
| **Can't find the blind spots** | Getting a problem wrong only tells you the answer was wrong, not which foundational knowledge point is missing |
| **Don't know the next step** | Facing piles of materials, you can't plan a review order or decide what to focus on |

### Positioning: Not "Upload PDF → AI Summary"

> Traditional AI can summarize a document for you, but it won't tell you:
> "You can't grasp pointers because you haven't really understood memory addresses."

Zhixu aims to extend learning from "solving a single problem" to "understanding a person's world of knowledge":

- Turn course materials into an **explorable knowledge graph** (knowledge points + prerequisite / related / contains relations)
- Make AI Q&A answer **based on your course materials**, and trace sources back to file name and page number
- **Locate blind spots** through quizzes and prerequisite relations, and derive **what to learn next**

### How It Differs from General-Purpose AI Chat

| | General-purpose AI chat | Zhixu |
| --- | --- | --- |
| Goal | Answer a single question | Present the knowledge structure of an entire course |
| Context | Reads whatever you paste | All your course materials, traceable to page numbers |
| Wrong answers | Gives the correct answer | Links to a specific knowledge point, affecting mastery and learning path |
| Learning progress | One-off answer | Generates a personalized learning path based on prerequisite relations |

### Who It's For

It's for **long-term learners** — people who need to build a knowledge system. Today it serves one C programming course; later it can expand to subjects such as advanced mathematics, physics, and linear algebra, and ultimately it hopes to become **the school's own AI learning platform**.

> Let every student own their knowledge system, and give learning back to students.

---

## Core Features

| Module | Description |
| --- | --- |
| **Course management & material upload** | Create / edit / delete courses; upload PDF, DOCX, PPTX, TXT, Markdown; **uploads return immediately and are parsed asynchronously in the background**, with the page polling progress automatically (waiting to process / parsing / extracting knowledge / completed / failed); chapters and page numbers are preserved automatically and stored in chunks |
| **AI knowledge graph generation** | Extracts knowledge points and relations (definition, chapter, difficulty, source, prerequisite / related / contains / instance relations); saves structured JSON; deduplicates knowledge points; marks them as "pending confirmation" by default; supports manual add, edit, and delete |
| **Interactive knowledge graph** | React Flow canvas: node dragging, zoom, pan, search, filtering by chapter / relation, related highlighting, prerequisite viewing, layered layout; blue = mastered, yellow = learning, red = needs review, gray = not learned; click a node to open the details panel |
| **AI personalized learning assistant** | RAG Q&A grounded in course materials, citing source file and page number; knowledge point explanations (plain / detailed / with examples / with analogies / with code); Socratic guidance; jumps to related knowledge graph nodes |
| **Knowledge blind-spot diagnosis & quizzes** | Single-choice / multiple-choice / true-false / short-answer / code questions; each question links to a knowledge point; after grading, explanations and likely misconceptions are given; mastery status is updated |
| **Personalized learning path** | Generates the learning order by topologically sorting prerequisite relations; automatically skips mastered knowledge points; progress tracking and completion feedback |

---

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn-style components, `@xyflow/react` (React Flow), Lucide icons
- **Backend**: Next.js Route Handlers (Node.js runtime)
- **Database**:
  - Local development: **SQLite** (Node 24 built-in `node:sqlite`, zero native dependencies)
  - Production (Route A): **SQLite + persistent volume**, with `DATA_DIR` pointing at the mounted volume; goes live with almost no changes
  - Production (Route B, at scale): **Supabase / PostgreSQL** (migration SQL in `supabase/migrations/`)
- **Deployment**: Docker (see [`Dockerfile`](Dockerfile)) + any platform that supports long-running processes and persistent volumes (Railway / Render / Fly.io, etc.)
- **AI**: OpenAI-compatible API (any provider configurable), called server-side, structured output + zod validation, with a built-in demo engine as fallback
- **Document parsing**: `unpdf` (PDF), `mammoth` (DOCX), `jszip` (PPTX)

---

## Quick Start (Local Development)

### Requirements

- Node.js ≥ 22.5 (24 recommended, for the built-in `node:sqlite`)
- npm (or pnpm / yarn)

### Steps

```bash
# 1. Install dependencies
npm install
# (pnpm also works: pnpm install)

# 2. (Optional) Configure an AI model, see "AI Model Configuration" below
#   It also runs without configuration and falls back to "demo mode" automatically

# 3. Start the development server
npm run dev
```

Open <http://localhost:3000> to use it. The first visit redirects to the login page, where you can use the built-in demo account:

- **Email**: `demo@zhixu.app`
- **Password**: `demo123`

You can also click "Sign up" to create your own account. On first start, database tables are created automatically and a **demo course "C Programming"** is seeded (with knowledge graph, quizzes, learning records, and learning paths), so you can experience the full flow out of the box.

### Common Commands

```bash
npm run dev        # Development server (auto-compiles, code changes take effect immediately)
npm run build      # Production build
npm start          # Run the production build (requires npm run build first)
npm run typecheck  # TypeScript type checking
npm run lint       # ESLint
```

> ⚠️ **Do not run `npm run dev` and `npm start` at the same time**: both share the same `.next` directory,
> and dev mode rewrites it with development artifacts, so the running production server immediately can't find its build files,
> which shows up as **pages that render but all static assets returning 400, every button dead, and a `client-side exception` error**.
>
> When switching run modes, follow this order:
> 1. Stop the current server (`Ctrl + C`)
> 2. Delete `.next`
> 3. Run `npm run dev`, or run `npm run build` and then `npm start`
>
> Likewise, **do not run `npm run build` while the server is running**.

### Walk Through the Full Flow

1. Open the home page and enter the "C Programming" course.
2. Click "Knowledge Graph", then drag / zoom / click nodes to view details.
3. Go to "AI Tutor" and ask a question, for example *"What do malloc and free do?"*.
4. Go to "Quiz", generate and answer a quiz, then submit it to see mastery changes.
5. Go to "Learning Path", choose the target knowledge point "Dynamic Memory Allocation", and view the automatically derived learning order.
6. On the course detail page, use "Upload Material" to upload any PDF and observe the parsing and knowledge extraction results.

---

## User Login & Accounts

Zhixu ships with a **built-in local account system** that works out of the box with no external service:

- Sign up / sign in / sign out, with passwords salted and hashed using Node's built-in `scrypt`
- httpOnly cookie-based sessions (30-day validity), with middleware intercepting unauthenticated requests
- All courses, materials, knowledge graphs, and learning records are isolated per user (invisible to others)
- Each user can configure their own AI model on the "Settings" page (independent of others)

> Production deployments can upgrade smoothly to **Supabase Auth**: the `profiles` table is already designed against `auth.users(id)`; only the auth layer and the data-access adapter need to be replaced (see "Deploy to Supabase + Vercel").

---

## AI Model Configuration

There are **two** ways to configure it, in order of precedence:

1. **UI configuration (recommended)**: after signing in, go to the "Settings" page, enter the API Key, base URL, and model, then save — it takes effect immediately and is stored per user.
2. **Environment variables**: copy `.env.example` to `.env.local` and fill it in:

```env
# OpenAI-compatible endpoint (can be any compatible provider)
AI_API_KEY=sk-xxxx
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
# Optional: use a faster/cheaper model for knowledge extraction
AI_EXTRACT_MODEL=
# Optional: max output tokens per reply. Reasoning models consume a lot of tokens thinking first;
# if the AI tutor occasionally falls back to demo mode, increase this (default 8192)
AI_MAX_TOKENS=8192
# Optional: max output tokens for structured JSON calls (knowledge extraction) (default 16000)
AI_EXTRACT_MAX_TOKENS=16000
# Optional: per-request timeout in milliseconds (default 300000)
AI_TIMEOUT_MS=300000
# Optional: retry count for 429 / 5xx / network errors (default 2)
AI_MAX_RETRIES=2
# Optional: set to 1 to block Base URLs pointing at localhost/private networks (SSRF protection); keep 0 when using Ollama
AI_BLOCK_PRIVATE_BASE_URL=0
```

Upload and background-processing settings (optional):

```env
# Max upload size (MB, default 100)
MAX_UPLOAD_SIZE_MB=100
# Background processing timeout per document (ms, default 1800000 = 30 minutes)
# After a timeout the document is marked failed and the queue moves on to the next, avoiding a permanent stuck state
DOC_PROCESS_TIMEOUT_MS=1800000
# Data directory: point at the persistent volume when deploying (default ./data locally)
DATA_DIR=/data
```

Any **OpenAI-compatible** service is supported (OpenAI, DeepSeek, Moonshot, Qwen, local Ollama, etc.); just change `AI_BASE_URL` and `AI_MODEL`. All model calls are made server-side.

### Integration Details & Security

- **API keys are never sent to the frontend**: the settings page only shows whether a key is configured and a masked preview (e.g. `sk-…abcd`); the API never returns the full key.
- **Connection self-check**: the settings page offers a "Test Connection" button that makes a real model call and returns the latency or the specific error (invalid key / wrong base URL / model not found / rate limiting, etc.).
- **Automatic retries**: 429, 5xx, and network errors are retried automatically with exponential backoff (2 times by default).
- **Parameter compatibility**: some newer models require `max_completion_tokens` instead of `max_tokens`; the request is retried automatically with that parameter.
- **Failures are visible**: when an AI call fails and falls back to the demo engine, the material card shows a yellow warning instead of degrading silently.
- **Base URL validation**: must be a complete address starting with `http(s)://`; multi-user deployments can set `AI_BLOCK_PRIVATE_BASE_URL=1` to block private-network targets (SSRF protection).
- ⚠️ **Key storage**: user-level keys are stored in plain text in the local SQLite database (`user_settings` table). That's acceptable for local self-hosting; if you deploy it for multiple people, prefer injecting keys only through environment variables, or add encryption and access control to the database.

### AI Behavior per Capability

| Capability | With a key | Without a key (demo mode) |
| --- | --- | --- |
| Knowledge extraction | LLM structured output (zod validated) | Built-in glossary heuristic extraction, labeled "demo engine" in the UI |
| AI tutor | RAG retrieval + LLM generation | Keyword retrieval + template replies, clearly labeled as not a large model |
| Question generation | LLM-generated questions | Rule-based questions, labeled "demo engine" |

---

## Demo Mode

**Demo mode is not fake data in disguise.** When `AI_API_KEY` is not configured:

- Knowledge extraction uses a deterministic rule engine with a **built-in glossary + co-occurrence relations**; all output has `verified=false` (pending confirmation) and low confidence, and is clearly labeled in the UI.
- AI tutor replies are generated by **keyword retrieval + templates**, and the end of each reply states "generated by the demo rule engine".
- The knowledge graph of the built-in demo course is **hand-written** sample data, intended to show the product shape; it does not represent real AI analysis.

Once `AI_API_KEY` is configured, the capabilities above switch to a real large model automatically.

---

## Project Structure

```
zhixu/
├── src/
│   ├── app/                      # App Router pages + API
│   │   ├── page.tsx              # Home dashboard
│   │   ├── courses/              # Course management + course detail
│   │   ├── courses/[courseId]/   # graph / tutor / quiz / path
│   │   ├── profile/              # Learning center
│   │   └── api/                  # Route Handlers
│   ├── components/
│   │   ├── ui/                   # Base UI components (shadcn style)
│   │   ├── layout/               # App shell / sidebar / theme
│   │   └── graph/                # Knowledge graph (layout, nodes, details)
│   └── lib/
│       ├── types.ts              # Domain types
│       ├── db/                   # SQLite driver, schema, repositories, seed data
│       ├── ai/                   # Provider, schema, demo engine
│       ├── parser/               # Document parsing (PDF/DOCX/PPTX/TXT/MD)
│       ├── services/             # knowledge / retrieval / mastery / learning path / tutor / quiz / document pipeline
│       └── client.ts             # Client-side API wrapper
├── supabase/
│   └── migrations/               # PostgreSQL migrations + RLS + pgvector
├── data/                         # Generated at runtime (SQLite database, uploaded files)
├── .env.example                  # Environment variable example
└── README.md
```

---

## Database Design

14 tables: `profiles`, `courses`, `documents`, `document_chunks`, `knowledge_nodes`, `knowledge_edges`, `learning_records`, `quizzes`, `quiz_questions`, `quiz_attempts`, `learning_paths`, `learning_path_items`, `chat_sessions`, `chat_messages`.

- All primary keys use UUID
- Sensible foreign keys and indexes
- `created_at` / `updated_at`
- Courses belong to an `owner_id`, and **Row Level Security** ensures users can only access their own courses and private materials

See [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) for the full SQL, and [`0002_vector.sql`](supabase/migrations/0002_vector.sql) for vector search.

---

## Deployment (Route A: Persistent Volume)

Suitable for team / small-scale use: **keep SQLite + local file storage** and just mount the data directory on a persistent volume; it goes live with almost no changes.
See [`DEPLOY.md`](DEPLOY.md) for the full steps; it comes down to three:

1. Build the image with [`Dockerfile`](Dockerfile) (or let the platform detect it)
2. Mount a persistent volume at `/data` and set `DATA_DIR=/data`
3. Configure the AI environment variables and generate a public domain

```bash
docker build -t zhixu .
docker run -d -p 3000:3000 -v zhixu-data:/data -e DATA_DIR=/data \
  -e AI_BASE_URL=https://api.deepseek.com -e AI_MODEL=deepseek-chat -e AI_API_KEY=sk-xxxx zhixu
```

> Document processing is now **asynchronous in the background**: the upload endpoint returns immediately, the background queue parses and extracts knowledge, and the frontend polls the status;
> document jobs left unfinished are resumed automatically after a process restart.
>
> Recommended platforms: Railway / Render / Fly.io (all support long-running processes + persistent volumes).

## Deploy to Supabase + Vercel (Route B)

Take this route once the user base grows and you need horizontal scaling across multiple instances (it requires more rework: the data layer and file storage must be replaced):

1. Create a project in Supabase and run `supabase/migrations/0001_init.sql` in the SQL Editor (optionally run `0002_vector.sql` afterwards).
2. Configure Supabase Storage for file storage.
3. Deploy this project on Vercel and configure the environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
AI_API_KEY=...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

> Note: the current local data-access layer uses SQLite as its runtime store. Route B requires replacing `src/lib/db/repo.ts` with an implementation based on the Supabase client (the schema and migration SQL are fully aligned, so it can be swapped in seamlessly), switching file uploads to Supabase Storage, and adding a background task queue (processes are not long-lived in a serverless environment).

---

## API Overview

| Method | Path | Description |
| --- | --- | --- |
| GET/POST | `/api/courses` | List / create courses |
| GET/PATCH/DELETE | `/api/courses/:id` | Course detail / update / delete |
| GET | `/api/courses/:id/graph` | Knowledge graph (nodes + relations) |
| GET/POST | `/api/courses/:id/documents` | List materials / upload (**returns immediately, processed asynchronously in the background**) |
| POST/DELETE | `/api/documents/:id` | Reprocess / delete |
| GET/POST | `/api/courses/:id/nodes` | List nodes / add manually |
| GET/PATCH/DELETE | `/api/nodes/:id` | Node detail / update / delete |
| POST/DELETE | `/api/courses/:id/edges` | Add / delete a relation |
| GET/POST | `/api/courses/:id/chat` | List sessions / ask a question |
| GET | `/api/chat/:sessionId` | Session messages |
| GET/POST | `/api/courses/:id/quiz` | List quizzes / generate |
| GET/POST | `/api/quiz/:id` | Quiz content / submit for grading |
| GET/POST | `/api/courses/:id/path` | Latest path / generate |
| GET/PATCH | `/api/path/:id` | Path detail / update progress |
| GET | `/api/profile` | Personal learning overview |

---

## Implemented Features

- ✅ Course CRUD, course cards and statistics
- ✅ Material upload (PDF/DOCX/PPTX/TXT/MD) with parsing status transitions, reprocessing, and deletion
- ✅ Visible parsing quality: page through the actual extracted text chunks (with page numbers / chapters)
- ✅ Upload robustness: extension-based fallback when MIME is missing, duplicate upload detection (409), warnings for scanned PDFs with too little text, automatic GBK text detection
- ✅ Background queue reliability: per-document timeout + watchdog + queue position hints, so large files don't block the queue
- ✅ **Asynchronous background document processing**: uploads return immediately, a background queue parses and extracts, the frontend polls progress automatically, and work can be recovered after a process crash
- ✅ **Production deployment support**: `DATA_DIR` persistent volume, Dockerfile, Railway/Render/Fly deployment docs
- ✅ **Chinese bigram + BM25 retrieval** (better Chinese tokenization and keyword recall)
- ✅ AI knowledge extraction (LLM structured output + demo engine fallback), deduplication, pending-confirmation marking
- ✅ Interactive knowledge graph (React Flow: drag / zoom / pan / search / filter / highlight / layered layout / details panel / manual add and delete)
- ✅ Four-color mastery visual convention and explainable rule-based scoring
- ✅ AI tutor RAG Q&A (source citation + knowledge node recommendations + session history)
- ✅ Five question types in quizzes, grading, explanations, and mastery linkage
- ✅ Personalized learning paths based on prerequisite relations (mastered items skipped automatically)
- ✅ Home dashboard and personal learning center
- ✅ Light and dark themes, responsive layout
- ✅ Local account system: sign up / sign in / sign out, salted password hashing, cookie sessions, middleware login interception, per-user data isolation
- ✅ UI-based AI configuration (settings page, per-user override of environment variables, any OpenAI-compatible service)
- ✅ Supabase migration SQL + RLS + pgvector
- ✅ TypeScript type checking, ESLint, production build

## Not Implemented / To Be Improved

- ⏳ Supabase Auth (currently a local account system; can be replaced smoothly in production — `profiles` is already designed against `auth.users`)
- ⏳ Supabase data-access adapter for production (schema is ready)
- ⏳ File uploads wired to Supabase Storage
- ⏳ Runtime wiring for pgvector vector retrieval (currently Chinese bigram + BM25 keyword retrieval; the migration is ready)
- ⏳ Spaced repetition review (SM-2) and a wrong-answer notebook (assessed as high value, not yet implemented)
- ⏳ In-graph bulk review UI for knowledge relations (currently single-item editing is supported)
- ⏳ Page information for DOCX/PPTX (DOCX has no pagination information; PPTX uses slide numbers as pages)

## Known Issues & Future Optimizations

- **Differences between local SQLite and production PostgreSQL**: locally we use `node:sqlite` (synchronous API); production requires the Supabase client implementation. This can be abstracted further behind a unified repository interface.
- **Large-file parsing consumes CPU**: parsing a 1000+ page PDF briefly occupies the event loop, during which other requests may slow down; for concurrent multi-user uploads, consider moving parsing into a worker thread.
- **Cross-language retrieval**: Chinese questions retrieve weak matches from chunks of English textbooks (knowledge node context can serve as a fallback); this will be solved by vector retrieval.
- **Limits of keyword retrieval**: Chinese bigram + BM25 already improves tokenization and recall noticeably, but synonym/semantic matching is still weak; deploying pgvector will improve it further.
- **Mastery scoring**: currently a transparent rule-based score; it can be refined by weighting question difficulty, repeated test performance, and a forgetting curve (spaced repetition).
- **Graph performance**: at very large knowledge-point scales (>500 nodes), React Flow rendering needs virtualization and incremental layout.

---

## Changelog

Key changes per version are listed below; see [CHANGELOG.md](CHANGELOG.md) for details and [docs/releases/](docs/releases/README.md) for the full per-version release reports.

| Version | Main changes |
| --- | --- |
| **v2.2.0** | AI integration security hardening (key masking, base URL validation, retries, compatibility with `max_completion_tokens`/`temperature`, test connection); document upload robustness (queue concurrency + timeout + watchdog, queue position hints, MIME fallback, duplicate upload detection, GBK detection, scanned-file warnings, viewing parsed content, streaming writes to disk); extraction model fallback chain fix; polling no longer flickers |
| v2.1.0 | Asynchronous background document processing (progress polling + crash recovery), `DATA_DIR` persistent volume deployment, Docker deployment docs, Chinese bigram + BM25 retrieval, AI tutor reasoning-model token fix |
| v2.0.2 | Fixed a client-side rendering error on the quiz page (missing Suspense around `useSearchParams`) |
| v2.0.1 | Fixed a login redirect loop (caused by a stale cookie) |
| v2.0.0 | User sign-in/sign-up, UI-based AI configuration, batched knowledge extraction, Chinese/English switching, black-white-gray themes |
| v1.0.0 | First release: course management, material parsing, knowledge graph, AI tutor, quizzes, learning paths |

---

## License

For learning and demonstration purposes only. Course materials are private user data by default; do not upload sensitive information.
