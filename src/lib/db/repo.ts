// 数据访问层 —— 所有查询集中于此，接口层（Route Handlers）只调用这里。
import { randomUUID } from "node:crypto";
import { all, get, run, now } from "./driver";
import type {
  Course,
  CourseStats,
  CourseWithStats,
  Difficulty,
  Document,
  DocumentChunk,
  GraphData,
  KnowledgeEdge,
  KnowledgeNode,
  LearningPath,
  LearningPathItem,
  MasteryStatus,
  Profile,
  Quiz,
  QuizAttempt,
  QuizView,
  Session,
  UserSettings,
} from "../types";

export function uuid(): string {
  return randomUUID();
}

// ---------------- Profiles / Sessions / Settings ----------------

const PROFILE_SELECT = `SELECT id, email, name, password_hash AS passwordHash, avatar_url AS avatarUrl,
  created_at AS createdAt, updated_at AS updatedAt FROM profiles`;

function rowToProfile(r: Record<string, unknown>): Profile {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    password_hash: r.passwordHash == null ? null : String(r.passwordHash),
    avatar_url: r.avatarUrl == null ? null : String(r.avatarUrl),
    created_at: String(r.createdAt ?? r.created_at),
    updated_at: String(r.updatedAt ?? r.updated_at),
  };
}

export function getUserByEmail(email: string): Profile | undefined {
  const r = get<Record<string, unknown>>(`${PROFILE_SELECT} WHERE email = ?`, [email.toLowerCase().trim()]);
  return r ? rowToProfile(r) : undefined;
}

export function getUserById(id: string): Profile | undefined {
  const r = get<Record<string, unknown>>(`${PROFILE_SELECT} WHERE id = ?`, [id]);
  return r ? rowToProfile(r) : undefined;
}

export function createUser(name: string, email: string, passwordHash: string): Profile {
  const id = uuid();
  const t = now();
  run(
    "INSERT INTO profiles (id, email, name, password_hash, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
    [id, email.toLowerCase().trim(), name.trim(), passwordHash, t, t]
  );
  return getUserById(id)!;
}

export function createSessionRecord(userId: string, tokenHash: string, expiresAt: string): void {
  run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    [uuid(), userId, tokenHash, expiresAt, now()]
  );
}

export function getSessionByTokenHash(tokenHash: string): Session | undefined {
  const r = get<Record<string, unknown>>(
    "SELECT id, user_id AS userId, token_hash AS tokenHash, expires_at AS expiresAt, created_at AS createdAt FROM sessions WHERE token_hash = ?",
    [tokenHash]
  );
  if (!r) return undefined;
  return {
    id: String(r.id),
    user_id: String(r.userId),
    token_hash: String(r.tokenHash),
    expires_at: String(r.expiresAt),
    created_at: String(r.createdAt),
  };
}

export function deleteSessionByTokenHash(tokenHash: string): void {
  run("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

export function getUserSettings(userId: string): UserSettings | undefined {
  const r = get<Record<string, unknown>>(
    `SELECT id, user_id AS userId, ai_api_key AS aiApiKey, ai_base_url AS aiBaseUrl,
      ai_model AS aiModel, ai_extract_model AS aiExtractModel, created_at AS createdAt, updated_at AS updatedAt
     FROM user_settings WHERE user_id = ?`,
    [userId]
  );
  if (!r) return undefined;
  return {
    id: String(r.id),
    user_id: String(r.userId),
    ai_api_key: r.aiApiKey == null ? null : String(r.aiApiKey),
    ai_base_url: r.aiBaseUrl == null ? null : String(r.aiBaseUrl),
    ai_model: r.aiModel == null ? null : String(r.aiModel),
    ai_extract_model: r.aiExtractModel == null ? null : String(r.aiExtractModel),
    created_at: String(r.createdAt),
    updated_at: String(r.updatedAt),
  };
}

export function upsertUserSettings(
  userId: string,
  input: { ai_api_key: string | null; ai_base_url: string | null; ai_model: string | null; ai_extract_model: string | null }
): UserSettings {
  const existing = getUserSettings(userId);
  const t = now();
  if (existing) {
    run(
      "UPDATE user_settings SET ai_api_key = ?, ai_base_url = ?, ai_model = ?, ai_extract_model = ?, updated_at = ? WHERE user_id = ?",
      [input.ai_api_key, input.ai_base_url, input.ai_model, input.ai_extract_model, t, userId]
    );
  } else {
    run(
      "INSERT INTO user_settings (id, user_id, ai_api_key, ai_base_url, ai_model, ai_extract_model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [uuid(), userId, input.ai_api_key, input.ai_base_url, input.ai_model, input.ai_extract_model, t, t]
    );
  }
  return getUserSettings(userId)!;
}

// ---------------- Courses ----------------

function rowToCourse(r: Record<string, unknown>): Course {
  return {
    id: String(r.id),
    name: String(r.name),
    description: r.description == null ? null : String(r.description),
    owner_id: String(r.ownerId ?? r.owner_id),
    created_at: String(r.createdAt ?? r.created_at),
    updated_at: String(r.updatedAt ?? r.updated_at),
  };
}

export function getCourseStats(courseId: string): CourseStats {
  const doc = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM documents WHERE course_id = ?",
    [courseId]
  );
  const nodes = get<Record<string, number>>(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN mastery_status='mastered' THEN 1 ELSE 0 END) AS mastered,
      SUM(CASE WHEN mastery_status='learning' THEN 1 ELSE 0 END) AS learning,
      SUM(CASE WHEN mastery_status='review' THEN 1 ELSE 0 END) AS review,
      SUM(CASE WHEN mastery_status='untouched' THEN 1 ELSE 0 END) AS untouched
    FROM knowledge_nodes WHERE course_id = ?`,
    [courseId]
  );
  const edges = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM knowledge_edges WHERE course_id = ?",
    [courseId]
  );
  const quizzes = get<{ c: number }>(
    "SELECT COUNT(*) AS c FROM quizzes WHERE course_id = ?",
    [courseId]
  );
  const total = Number(nodes?.total ?? 0);
  const mastered = Number(nodes?.mastered ?? 0);
  return {
    document_count: Number(doc?.c ?? 0),
    node_count: total,
    edge_count: Number(edges?.c ?? 0),
    mastered_count: mastered,
    learning_count: Number(nodes?.learning ?? 0),
    review_count: Number(nodes?.review ?? 0),
    untouched_count: Number(nodes?.untouched ?? 0),
    quiz_count: Number(quizzes?.c ?? 0),
    progress: total === 0 ? 0 : Math.round((mastered / total) * 100),
  };
}

export function listCourses(ownerId: string): CourseWithStats[] {
  const rows = all<Record<string, unknown>>(
    "SELECT id, name, description, owner_id AS ownerId, created_at AS createdAt, updated_at AS updatedAt FROM courses WHERE owner_id = ? ORDER BY updated_at DESC",
    [ownerId]
  );
  return rows.map((r) => {
    const course = rowToCourse(r);
    return { ...course, stats: getCourseStats(course.id) };
  });
}

export function getCourse(id: string): Course | undefined {
  const r = get<Record<string, unknown>>(
    "SELECT id, name, description, owner_id AS ownerId, created_at AS createdAt, updated_at AS updatedAt FROM courses WHERE id = ?",
    [id]
  );
  return r ? rowToCourse(r) : undefined;
}

export function createCourse(name: string, description: string | null, ownerId: string): Course {
  const id = uuid();
  const t = now();
  run(
    "INSERT INTO courses (id, name, description, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, name, description, ownerId, t, t]
  );
  return {
    id,
    name,
    description,
    owner_id: ownerId,
    created_at: t,
    updated_at: t,
  };
}

export function updateCourse(
  id: string,
  name: string,
  description: string | null
): Course | undefined {
  run(
    "UPDATE courses SET name = ?, description = ?, updated_at = ? WHERE id = ?",
    [name, description, now(), id]
  );
  return getCourse(id);
}

export function deleteCourse(id: string): void {
  run("DELETE FROM courses WHERE id = ?", [id]);
}

// ---------------- Documents ----------------

function rowToDocument(r: Record<string, unknown>): Document {
  return {
    id: String(r.id),
    course_id: String(r.courseId ?? r.course_id),
    filename: String(r.filename),
    storage_path: r.storagePath == null ? null : String(r.storagePath),
    mime_type: String(r.mimeType ?? r.mime_type),
    size_bytes: Number(r.sizeBytes ?? r.size_bytes ?? 0),
    status: String(r.status) as Document["status"],
    page_count: r.pageCount == null ? null : Number(r.pageCount),
    chunk_count: r.chunkCount == null ? null : Number(r.chunkCount),
    parse_error: r.parseError == null ? null : String(r.parseError),
    created_at: String(r.createdAt ?? r.created_at),
    updated_at: String(r.updatedAt ?? r.updated_at),
  };
}

const DOC_SELECT = `SELECT id, course_id AS courseId, filename, storage_path AS storagePath,
  mime_type AS mimeType, size_bytes AS sizeBytes, status, page_count AS pageCount,
  chunk_count AS chunkCount, parse_error AS parseError, created_at AS createdAt,
  updated_at AS updatedAt FROM documents`;

export function listDocuments(courseId: string): Document[] {
  return all<Record<string, unknown>>(`${DOC_SELECT} WHERE course_id = ? ORDER BY created_at DESC`, [
    courseId,
  ]).map(rowToDocument);
}

/** 列出「上次进程中断时未处理完」的文档，用于服务启动后恢复后台任务。 */
export function listInterruptedDocuments(): { id: string; user_id: string }[] {
  return all<{ id: string; user_id: string }>(
    `SELECT d.id AS id, c.owner_id AS user_id
     FROM documents d JOIN courses c ON c.id = d.course_id
     WHERE d.status IN ('pending','parsing','extracting')`
  );
}

export function getDocument(id: string): Document | undefined {
  const r = get<Record<string, unknown>>(`${DOC_SELECT} WHERE id = ?`, [id]);
  return r ? rowToDocument(r) : undefined;
}

export function createDocument(input: {
  course_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}): Document {
  const id = uuid();
  const t = now();
  run(
    `INSERT INTO documents (id, course_id, filename, storage_path, mime_type, size_bytes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, input.course_id, input.filename, null, input.mime_type, input.size_bytes, t, t]
  );
  return getDocument(id)!;
}

export function updateDocumentStatus(
  id: string,
  status: Document["status"],
  extra?: { page_count?: number; chunk_count?: number; parse_error?: string | null }
): void {
  // 注意：parse_error 需要能被显式清除为 null（否则重试成功后会残留上次的错误/警告），
  // 因此这里区分「未传该字段」（保持原值）与「显式传 null」（清空）。
  const hasParseError = extra !== undefined && Object.prototype.hasOwnProperty.call(extra, "parse_error");
  const params: unknown[] = [status, extra?.page_count ?? null, extra?.chunk_count ?? null];
  if (hasParseError) params.push(extra?.parse_error ?? null);
  params.push(now(), id);

  run(
    `UPDATE documents SET status = ?, page_count = COALESCE(?, page_count),
     chunk_count = COALESCE(?, chunk_count),
     parse_error = ${hasParseError ? "?" : "parse_error"}, updated_at = ? WHERE id = ?`,
    params
  );
}

export function deleteDocument(id: string): void {
  run("DELETE FROM documents WHERE id = ?", [id]);
}

export function listChunks(documentId: string): DocumentChunk[] {
  return all<Record<string, unknown>>(
    `SELECT id, document_id AS documentId, content, chunk_index AS chunkIndex,
      page_start AS pageStart, page_end AS pageEnd, section, created_at AS createdAt
     FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC`,
    [documentId]
  ).map((r) => ({
    id: String(r.id),
    document_id: String(r.documentId),
    content: String(r.content),
    chunk_index: Number(r.chunkIndex),
    page_start: r.pageStart == null ? null : Number(r.pageStart),
    page_end: r.pageEnd == null ? null : Number(r.pageEnd),
    section: r.section == null ? null : String(r.section),
    created_at: String(r.createdAt),
  }));
}

export function addChunks(
  documentId: string,
  chunks: { content: string; page_start: number | null; page_end: number | null; section: string | null }[]
): void {
  const t = now();
  const sql = `INSERT INTO document_chunks (id, document_id, content, chunk_index, page_start, page_end, section, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    run(sql, [
      uuid(),
      documentId,
      c.content,
      i,
      c.page_start,
      c.page_end,
      c.section,
      t,
    ]);
  }
}

export function deleteChunks(documentId: string): void {
  run("DELETE FROM document_chunks WHERE document_id = ?", [documentId]);
}

/** 分页读取分块（用于「查看解析内容」）。 */
export function listChunksPaged(
  documentId: string,
  offset: number,
  limit: number
): { chunks: DocumentChunk[]; total: number } {
  const total = Number(
    (get<{ n: number }>("SELECT COUNT(*) AS n FROM document_chunks WHERE document_id = ?", [documentId]) ?? { n: 0 }).n
  );
  const chunks = all<Record<string, unknown>>(
    `SELECT id, document_id AS documentId, content, chunk_index AS chunkIndex,
      page_start AS pageStart, page_end AS pageEnd, section, created_at AS createdAt
     FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT ? OFFSET ?`,
    [documentId, Math.max(0, limit), Math.max(0, offset)]
  ).map((r) => ({
    id: String(r.id),
    document_id: String(r.documentId),
    content: String(r.content),
    chunk_index: Number(r.chunkIndex),
    page_start: r.pageStart == null ? null : Number(r.pageStart),
    page_end: r.pageEnd == null ? null : Number(r.pageEnd),
    section: r.section == null ? null : String(r.section),
    created_at: String(r.createdAt),
  }));
  return { chunks, total };
}

/** 查找同课程下同名同大小的文档（用于重复上传检测）。 */
export function findDocumentByFilenameAndSize(
  courseId: string,
  filename: string,
  sizeBytes: number
): Document | undefined {
  const r = get<Record<string, unknown>>(
    `${DOC_SELECT} WHERE course_id = ? AND filename = ? AND size_bytes = ? LIMIT 1`,
    [courseId, filename, sizeBytes]
  );
  return r ? rowToDocument(r) : undefined;
}

/** 列出长时间停留在中间状态的文档（供后台看门狗使用）。 */
export function listStaleDocuments(olderThanMs: number): { id: string; user_id: string }[] {
  const threshold = new Date(Date.now() - olderThanMs).toISOString();
  return all<{ id: string; user_id: string }>(
    `SELECT d.id AS id, c.owner_id AS user_id
     FROM documents d JOIN courses c ON c.id = d.course_id
     WHERE d.status IN ('parsing','extracting') AND d.updated_at < ?`,
    [threshold]
  );
}

// ---------------- Knowledge Nodes & Edges ----------------

function rowToNode(r: Record<string, unknown>): KnowledgeNode {
  return {
    id: String(r.id),
    course_id: String(r.courseId ?? r.course_id),
    name: String(r.name),
    definition: r.definition == null ? null : String(r.definition),
    detail: r.detail == null ? null : String(r.detail),
    chapter: r.chapter == null ? null : String(r.chapter),
    difficulty: Number(r.difficulty ?? 3) as KnowledgeNode["difficulty"],
    source_document_id:
      r.sourceDocumentId == null ? null : String(r.sourceDocumentId),
    source_page: r.sourcePage == null ? null : Number(r.sourcePage),
    confidence: Number(r.confidence ?? 0.5),
    verified: Boolean(r.verified ?? 0),
    mastery_status: String(r.masteryStatus ?? r.mastery_status ?? "untouched") as MasteryStatus,
    created_at: String(r.createdAt ?? r.created_at),
    updated_at: String(r.updatedAt ?? r.updated_at),
  };
}

const NODE_SELECT = `SELECT id, course_id AS courseId, name, definition, detail, chapter, difficulty,
  source_document_id AS sourceDocumentId, source_page AS sourcePage, confidence, verified,
  mastery_status AS masteryStatus, created_at AS createdAt, updated_at AS updatedAt FROM knowledge_nodes`;

export function listNodes(courseId: string): KnowledgeNode[] {
  return all<Record<string, unknown>>(
    `${NODE_SELECT} WHERE course_id = ? ORDER BY name ASC`,
    [courseId]
  ).map(rowToNode);
}

export function getNode(id: string): KnowledgeNode | undefined {
  const r = get<Record<string, unknown>>(`${NODE_SELECT} WHERE id = ?`, [id]);
  return r ? rowToNode(r) : undefined;
}

export function createNode(
  input: Partial<KnowledgeNode> & { course_id: string; name: string }
): KnowledgeNode {
  const id = uuid();
  const t = now();
  run(
    `INSERT INTO knowledge_nodes (id, course_id, name, definition, detail, chapter, difficulty,
      source_document_id, source_page, confidence, verified, mastery_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'untouched', ?, ?)`,
    [
      id,
      input.course_id,
      input.name,
      input.definition ?? null,
      input.detail ?? null,
      input.chapter ?? null,
      input.difficulty ?? 3,
      input.source_document_id ?? null,
      input.source_page ?? null,
      input.confidence ?? 0.5,
      input.verified ? 1 : 0,
      t,
      t,
    ]
  );
  return getNode(id)!;
}

export function updateNode(
  id: string,
  patch: Partial<Pick<KnowledgeNode, "name" | "definition" | "detail" | "chapter" | "difficulty" | "verified" | "mastery_status">>
): KnowledgeNode | undefined {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (patch.name !== undefined) { fields.push("name = ?"); params.push(patch.name); }
  if (patch.definition !== undefined) { fields.push("definition = ?"); params.push(patch.definition); }
  if (patch.detail !== undefined) { fields.push("detail = ?"); params.push(patch.detail); }
  if (patch.chapter !== undefined) { fields.push("chapter = ?"); params.push(patch.chapter); }
  if (patch.difficulty !== undefined) { fields.push("difficulty = ?"); params.push(patch.difficulty); }
  if (patch.verified !== undefined) { fields.push("verified = ?"); params.push(patch.verified ? 1 : 0); }
  if (patch.mastery_status !== undefined) { fields.push("mastery_status = ?"); params.push(patch.mastery_status); }
  if (fields.length === 0) return getNode(id);
  fields.push("updated_at = ?");
  params.push(now(), id);
  run(`UPDATE knowledge_nodes SET ${fields.join(", ")} WHERE id = ?`, params);
  return getNode(id);
}

export function deleteNode(id: string): void {
  run("DELETE FROM knowledge_nodes WHERE id = ?", [id]);
}

function rowToEdge(r: Record<string, unknown>): KnowledgeEdge {
  return {
    id: String(r.id),
    course_id: String(r.courseId ?? r.course_id),
    source_node_id: String(r.sourceNodeId ?? r.source_node_id),
    target_node_id: String(r.targetNodeId ?? r.target_node_id),
    relation_type: String(r.relationType ?? r.relation_type) as KnowledgeEdge["relation_type"],
    evidence: r.evidence == null ? null : String(r.evidence),
    confidence: Number(r.confidence ?? 0.5),
    verified: Boolean(r.verified ?? 0),
    created_at: String(r.createdAt ?? r.created_at),
  };
}

const EDGE_SELECT = `SELECT id, course_id AS courseId, source_node_id AS sourceNodeId, target_node_id AS targetNodeId,
  relation_type AS relationType, evidence, confidence, verified, created_at AS createdAt FROM knowledge_edges`;

export function listEdges(courseId: string): KnowledgeEdge[] {
  return all<Record<string, unknown>>(
    `${EDGE_SELECT} WHERE course_id = ? ORDER BY created_at ASC`,
    [courseId]
  ).map(rowToEdge);
}

export function getGraph(courseId: string): GraphData {
  return { nodes: listNodes(courseId), edges: listEdges(courseId) };
}

export function createEdge(
  input: {
    course_id: string;
    source_node_id: string;
    target_node_id: string;
    relation_type: KnowledgeEdge["relation_type"];
    evidence?: string | null;
    confidence?: number;
    verified?: boolean;
  }
): KnowledgeEdge {
  const id = uuid();
  const t = now();
  run(
    `INSERT INTO knowledge_edges (id, course_id, source_node_id, target_node_id, relation_type, evidence, confidence, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.course_id,
      input.source_node_id,
      input.target_node_id,
      input.relation_type,
      input.evidence ?? null,
      input.confidence ?? 0.5,
      input.verified ? 1 : 0,
      t,
    ]
  );
  const r = get<Record<string, unknown>>(`${EDGE_SELECT} WHERE id = ?`, [id]);
  return rowToEdge(r!);
}

export function deleteEdge(id: string): void {
  run("DELETE FROM knowledge_edges WHERE id = ?", [id]);
}

export function setMastery(nodeId: string, status: MasteryStatus): void {
  run(
    "UPDATE knowledge_nodes SET mastery_status = ?, updated_at = ? WHERE id = ?",
    [status, now(), nodeId]
  );
}

// ---------------- Learning records ----------------

export function addRecord(input: {
  user_id: string;
  course_id: string;
  node_id: string | null;
  action_type: string;
  detail?: string | null;
  score?: number | null;
}): void {
  run(
    `INSERT INTO learning_records (id, user_id, course_id, node_id, action_type, detail, score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), input.user_id, input.course_id, input.node_id, input.action_type, input.detail ?? null, input.score ?? null, now()]
  );
}

// ---------------- Quizzes ----------------

export function createQuiz(courseId: string, title: string, nodeIds: string[]): Quiz {
  const id = uuid();
  run(
    "INSERT INTO quizzes (id, course_id, title, node_ids, created_at) VALUES (?, ?, ?, ?, ?)",
    [id, courseId, title, JSON.stringify(nodeIds), now()]
  );
  return { id, course_id: courseId, title, node_ids: JSON.stringify(nodeIds), created_at: now() };
}

export function addQuestion(q: {
  quiz_id: string;
  type: string;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  node_id: string | null;
  difficulty: number;
}): void {
  run(
    `INSERT INTO quiz_questions (id, quiz_id, type, stem, options, answer, explanation, node_id, difficulty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid(), q.quiz_id, q.type, q.stem, JSON.stringify(q.options), q.answer, q.explanation, q.node_id, q.difficulty]
  );
}

export function getQuizView(quizId: string): QuizView | undefined {
  const quiz = get<Quiz>(
    "SELECT id, course_id AS courseId, title, node_ids AS nodeIds, created_at AS createdAt FROM quizzes WHERE id = ?",
    [quizId]
  );
  if (!quiz) return undefined;
  const questions = all<Record<string, unknown>>(
    `SELECT qq.id, qq.type, qq.stem, qq.options, qq.answer, qq.explanation,
      qq.node_id AS nodeId, qq.difficulty, kn.name AS nodeName
     FROM quiz_questions qq LEFT JOIN knowledge_nodes kn ON kn.id = qq.node_id
     WHERE qq.quiz_id = ? ORDER BY qq.rowid ASC`,
    [quizId]
  ).map((r) => ({
    id: String(r.id),
    type: String(r.type) as QuizView["questions"][number]["type"],
    stem: String(r.stem),
    options: JSON.parse(String(r.options)) as string[],
    answer: String(r.answer),
    explanation: String(r.explanation),
    node_id: r.nodeId == null ? null : String(r.nodeId),
    node_name: r.nodeName == null ? null : String(r.nodeName),
    difficulty: Number(r.difficulty) as Difficulty,
  }));
  return { id: quiz.id, title: quiz.title, questions };
}

export function getQuizMeta(quizId: string): Quiz | undefined {
  return get<Quiz>(
    "SELECT id, course_id, title, node_ids, created_at FROM quizzes WHERE id = ?",
    [quizId]
  );
}

export function listQuizzes(courseId: string): Quiz[] {
  return all<Quiz>(
    "SELECT id, course_id, title, node_ids, created_at FROM quizzes WHERE course_id = ? ORDER BY created_at DESC",
    [courseId]
  );
}

export function addAttempt(input: {
  quiz_id: string;
  user_id: string;
  answers: unknown;
  score: number;
}): QuizAttempt {
  const id = uuid();
  run(
    "INSERT INTO quiz_attempts (id, quiz_id, user_id, answers, score, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, input.quiz_id, input.user_id, JSON.stringify(input.answers), input.score, now()]
  );
  return { id, quiz_id: input.quiz_id, user_id: input.user_id, answers: JSON.stringify(input.answers), score: input.score, created_at: now() };
}

export function listAttempts(quizId: string): QuizAttempt[] {
  return all<QuizAttempt>(
    "SELECT id, quiz_id, user_id, answers, score, created_at FROM quiz_attempts WHERE quiz_id = ? ORDER BY created_at DESC",
    [quizId]
  );
}

// ---------------- Learning paths ----------------

export function createPath(
  courseId: string,
  userId: string,
  targetNodeId: string
): LearningPath {
  const id = uuid();
  const t = now();
  run(
    "INSERT INTO learning_paths (id, course_id, user_id, target_node_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)",
    [id, courseId, userId, targetNodeId, t, t]
  );
  return { id, course_id: courseId, user_id: userId, target_node_id: targetNodeId, status: "in_progress", created_at: t, updated_at: t };
}

export function getPath(id: string): LearningPath | undefined {
  return get<LearningPath>(
    "SELECT id, course_id, user_id, target_node_id, status, created_at, updated_at FROM learning_paths WHERE id = ?",
    [id]
  );
}

export function addPathItem(input: {
  path_id: string;
  node_id: string;
  order_index: number;
  status: string;
}): void {
  run(
    "INSERT INTO learning_path_items (id, path_id, node_id, order_index, status, completed_at) VALUES (?, ?, ?, ?, ?, NULL)",
    [uuid(), input.path_id, input.node_id, input.order_index, input.status]
  );
}

export function listPathItems(pathId: string): LearningPathItem[] {
  return all<LearningPathItem>(
    `SELECT id, path_id, node_id, order_index, status, completed_at
     FROM learning_path_items WHERE path_id = ? ORDER BY order_index ASC`,
    [pathId]
  );
}

export function updatePathItem(id: string, status: string): void {
  run(
    "UPDATE learning_path_items SET status = ?, completed_at = CASE WHEN ? IN ('completed','skipped') THEN ? ELSE completed_at END WHERE id = ?",
    [status, status, now(), id]
  );
}

export function updatePathStatus(id: string, status: string): void {
  run("UPDATE learning_paths SET status = ?, updated_at = ? WHERE id = ?", [status, now(), id]);
}

export function latestPathFor(courseId: string, userId: string): LearningPath | undefined {
  return get<LearningPath>(
    "SELECT id, course_id, user_id, target_node_id, status, created_at, updated_at FROM learning_paths WHERE course_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1",
    [courseId, userId]
  );
}

// ---------------- Chat ----------------

export function createSession(courseId: string, userId: string, title: string): string {
  const id = uuid();
  const t = now();
  run(
    "INSERT INTO chat_sessions (id, course_id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [id, courseId, userId, title, t, t]
  );
  return id;
}

export function listSessions(courseId: string, userId: string): { id: string; title: string; updated_at: string }[] {
  return all<{ id: string; title: string; updated_at: string }>(
    "SELECT id, title, updated_at FROM chat_sessions WHERE course_id = ? AND user_id = ? ORDER BY updated_at DESC",
    [courseId, userId]
  ).map((r) => ({ id: String(r.id), title: String(r.title), updated_at: String(r.updated_at) }));
}

export function getChatSession(sessionId: string): { id: string; course_id: string; user_id: string } | undefined {
  const r = get<Record<string, unknown>>(
    "SELECT id, course_id AS courseId, user_id AS userId FROM chat_sessions WHERE id = ?",
    [sessionId]
  );
  if (!r) return undefined;
  return { id: String(r.id), course_id: String(r.courseId), user_id: String(r.userId) };
}

/** 删除会话（chat_messages 通过外键 ON DELETE CASCADE 一并删除）。 */
export function deleteChatSession(sessionId: string): void {
  run("DELETE FROM chat_sessions WHERE id = ?", [sessionId]);
}

export function addMessage(input: {
  session_id: string;
  role: "user" | "assistant";
  content: string;
  sources?: unknown[];
  node_refs?: string[];
}): void {
  run(
    "INSERT INTO chat_messages (id, session_id, role, content, sources, node_refs, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      uuid(),
      input.session_id,
      input.role,
      input.content,
      JSON.stringify(input.sources ?? []),
      JSON.stringify(input.node_refs ?? []),
      now(),
    ]
  );
  run("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", [now(), input.session_id]);
}

export function listMessages(sessionId: string): { role: string; content: string; sources: string; node_refs: string; created_at: string }[] {
  return all<{ role: string; content: string; sources: string; node_refs: string; created_at: string }>(
    "SELECT role, content, sources, node_refs, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
    [sessionId]
  ).map((r) => ({
    role: String(r.role),
    content: String(r.content),
    sources: String(r.sources),
    node_refs: String(r.node_refs),
    created_at: String(r.created_at),
  }));
}
