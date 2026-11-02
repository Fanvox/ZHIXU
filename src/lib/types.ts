// 知序 Zhixu — 核心领域类型定义

export type ID = string;

export type MasteryStatus = "mastered" | "learning" | "review" | "untouched";

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export type DocumentStatus =
  | "pending"
  | "parsing"
  | "extracting"
  | "completed"
  | "failed";

export type RelationType =
  | "prerequisite"
  | "related"
  | "contains"
  | "example_of";

export interface Profile {
  id: ID;
  email: string;
  name: string;
  password_hash: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: ID;
  user_id: ID;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface UserSettings {
  id: ID;
  user_id: ID;
  ai_api_key: string | null;
  ai_base_url: string | null;
  ai_model: string | null;
  ai_extract_model: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: ID;
  name: string;
  description: string | null;
  owner_id: ID;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: ID;
  course_id: ID;
  filename: string;
  storage_path: string | null;
  mime_type: string;
  size_bytes: number;
  status: DocumentStatus;
  page_count: number | null;
  chunk_count: number | null;
  parse_error: string | null;
  /** 仅文档列表接口返回：后台排队位置（1 = 下一个处理） */
  queue_position?: number | null;
  /** 仅文档列表接口返回：是否正在被后台处理 */
  is_processing?: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: ID;
  document_id: ID;
  content: string;
  chunk_index: number;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
  created_at: string;
}

export interface KnowledgeNode {
  id: ID;
  course_id: ID;
  name: string;
  definition: string | null;
  detail: string | null;
  chapter: string | null;
  difficulty: Difficulty;
  source_document_id: ID | null;
  source_page: number | null;
  confidence: number;
  verified: boolean;
  mastery_status: MasteryStatus;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeEdge {
  id: ID;
  course_id: ID;
  source_node_id: ID;
  target_node_id: ID;
  relation_type: RelationType;
  evidence: string | null;
  confidence: number;
  verified: boolean;
  created_at: string;
}

export interface LearningRecord {
  id: ID;
  user_id: ID;
  course_id: ID;
  node_id: ID | null;
  action_type:
    | "quiz_correct"
    | "quiz_wrong"
    | "review"
    | "explain"
    | "learn_start"
    | "learn_complete";
  detail: string | null;
  score: number | null;
  created_at: string;
}

export interface Quiz {
  id: ID;
  course_id: ID;
  title: string;
  node_ids: string; // JSON array
  created_at: string;
}

export type QuestionType =
  | "single"
  | "multiple"
  | "true_false"
  | "short_answer"
  | "code";

export interface QuizQuestion {
  id: ID;
  quiz_id: ID;
  type: QuestionType;
  stem: string;
  options: string; // JSON array
  answer: string;
  explanation: string;
  node_id: ID | null;
  difficulty: Difficulty;
}

export interface QuizAttempt {
  id: ID;
  quiz_id: ID;
  user_id: ID;
  answers: string; // JSON
  score: number;
  created_at: string;
}

export type PathStatus = "in_progress" | "completed";
export type PathItemStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface LearningPath {
  id: ID;
  course_id: ID;
  user_id: ID;
  target_node_id: ID;
  status: PathStatus;
  created_at: string;
  updated_at: string;
}

export interface LearningPathItem {
  id: ID;
  path_id: ID;
  node_id: ID;
  order_index: number;
  status: PathItemStatus;
  completed_at: string | null;
}

export interface ChatSession {
  id: ID;
  course_id: ID;
  user_id: ID;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: ID;
  session_id: ID;
  role: "user" | "assistant";
  content: string;
  sources: string; // JSON array of source objects
  node_refs: string; // JSON array of node ids
  created_at: string;
}

export interface SourceRef {
  document_id: ID;
  document_name: string;
  page: number | null;
  snippet: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  node_refs?: ID[];
}

// ---- API 响应类型 ----

export interface CourseStats {
  document_count: number;
  node_count: number;
  edge_count: number;
  mastered_count: number;
  learning_count: number;
  review_count: number;
  untouched_count: number;
  quiz_count: number;
  progress: number; // 0-100
}

export interface CourseWithStats extends Course {
  stats: CourseStats;
}

export interface GraphData {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface MasteryBreakdown {
  status: MasteryStatus;
  count: number;
  percentage: number;
}

export interface QuizQuestionView {
  id: ID;
  type: QuestionType;
  stem: string;
  options: string[];
  answer: string;
  explanation: string;
  node_id: ID | null;
  node_name: string | null;
  difficulty: Difficulty;
}

export interface QuizView {
  id: ID;
  title: string;
  questions: QuizQuestionView[];
}

export interface PathItemView {
  id: ID;
  node_id: ID;
  node_name: string;
  chapter: string | null;
  difficulty: Difficulty;
  mastery_status: MasteryStatus;
  status: PathItemStatus;
  order_index: number;
  completed_at: string | null;
  skipped: boolean; // 已掌握而跳过
}

export interface LearningPathView {
  id: ID;
  target_node_id: ID;
  target_node_name: string;
  status: PathStatus;
  items: PathItemView[];
}

// 学习路径生成结果
export interface PathStep {
  node_id: ID;
  node_name: string;
  chapter: string | null;
  difficulty: Difficulty;
  mastery_status: MasteryStatus;
  reason: "prerequisite" | "target";
  skip: boolean; // 已掌握，建议跳过
}
