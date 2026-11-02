// AI Provider 抽象 —— 统一封装 OpenAI-compatible 接口。
//
// 设计要点：
// - 未配置 API Key 时返回 null，由调用方降级到内置演示引擎（demo.ts）
// - 配置优先级：用户界面配置（user_settings）> 环境变量 > 默认值
// - 所有模型调用都在服务端完成；API Key 不会返回给前端（接口层只提供掩码预览）
// - 429 / 5xx / 网络错误会自动指数退避重试；部分新版模型要求
//   max_completion_tokens，会自动改用该参数重试一次
import { z } from "zod";
import { getUserSettings } from "../db/repo";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  extractModel: string;
}

// ---------------- 环境变量与默认值 ----------------

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** 单次请求超时（毫秒） */
const DEFAULT_TIMEOUT_MS = intEnv("AI_TIMEOUT_MS", 300_000);
/** 对话类调用的最大输出 token */
const DEFAULT_MAX_TOKENS = intEnv("AI_MAX_TOKENS", 8192);
/** 结构化 JSON 调用（知识抽取）的最大输出 token */
const EXTRACT_MAX_TOKENS = intEnv("AI_EXTRACT_MAX_TOKENS", 16_000);
/** 429 / 5xx / 网络错误的重试次数 */
const MAX_RETRIES = intEnv("AI_MAX_RETRIES", 2);
/** 生产多用户环境建议开启：禁止 Base URL 指向内网 / 本机（防 SSRF） */
const BLOCK_PRIVATE_BASE_URL = process.env.AI_BLOCK_PRIVATE_BASE_URL === "1";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

// ---------------- Base URL 校验 ----------------

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 0 || a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/**
 * 校验并规范化 Base URL：只允许 http/https 且必须带主机名。
 * 开启 AI_BLOCK_PRIVATE_BASE_URL 时拒绝内网地址。非法返回 null。
 */
export function normalizeBaseUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname) return null;
  if (BLOCK_PRIVATE_BASE_URL && isPrivateHost(url.hostname)) return null;
  return s.replace(/\/+$/, "");
}

/** 判断一段 Base URL 是否合法（供接口层校验使用）。 */
export function isValidBaseUrl(raw: string | null | undefined): boolean {
  const s = (raw ?? "").trim();
  if (!s) return true; // 空值表示「不设置」，合法
  return normalizeBaseUrl(s) != null;
}

// ---------------- 配置读取 ----------------

function envConfig(): AiConfig {
  return {
    apiKey: process.env.AI_API_KEY?.trim() ?? "",
    baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL) ?? DEFAULT_BASE_URL,
    model: process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
    extractModel: process.env.AI_EXTRACT_MODEL?.trim() || process.env.AI_MODEL?.trim() || DEFAULT_MODEL,
  };
}

export function aiConfig(userId?: string | null): AiConfig {
  const env = envConfig();
  if (userId) {
    const s = getUserSettings(userId);
    if (s) {
      return {
        apiKey: s.ai_api_key?.trim() || env.apiKey,
        baseUrl: normalizeBaseUrl(s.ai_base_url) ?? env.baseUrl,
        model: s.ai_model?.trim() || env.model,
        // 抽取模型的回退链：用户抽取模型 > 用户对话模型 > 环境默认。
        // （此前漏了「用户对话模型」这一层，导致用户只填了模型时抽取会错误地
        //  回退到环境默认值 gpt-4o-mini，从而对 DeepSeek 等服务全部报 400。）
        extractModel: s.ai_extract_model?.trim() || s.ai_model?.trim() || env.extractModel,
      };
    }
  }
  return env;
}

export function isAIEnabled(userId?: string | null): boolean {
  return aiConfig(userId).apiKey.length > 0;
}

/** 把 Key 处理成可安全展示的掩码（如 sk-…abcd）。 */
export function maskApiKey(key: string | null | undefined): string {
  const k = (key ?? "").trim();
  if (!k) return "";
  if (k.length <= 8) return "••••••";
  return `${k.slice(0, 3)}…${k.slice(-4)}`;
}

// ---------------- 调用实现 ----------------

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface AiCallError {
  message: string;
  status?: number;
}

interface CallResult {
  text: string | null;
  error: AiCallError | null;
  /** HTTP 层是否成功（推理模型可能返回空内容但仍算连接正常） */
  httpOk: boolean;
  latencyMs: number;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  retries?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(8_000, 600 * 2 ** attempt) + Math.floor(Math.random() * 300);
}

function describeHttpError(status: number, raw: string): string {
  let detail = "";
  try {
    const j = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    detail = (j?.error?.message ?? j?.message ?? "").trim();
  } catch {
    detail = raw.trim().slice(0, 200);
  }
  const hints: Record<number, string> = {
    400: "请求参数或模型名不被支持",
    401: "API Key 无效或已过期",
    403: "无权访问该模型",
    404: "接口地址或模型不存在（检查 Base URL 是否需要 /v1）",
    429: "触发限流，请稍后重试",
  };
  const head = hints[status] ? `${hints[status]}（HTTP ${status}）` : `请求失败（HTTP ${status}）`;
  return detail ? `${head}：${detail}` : head;
}

/** 底层调用：带超时、重试、参数兼容处理，返回结构化结果。 */
async function callChat(
  userId: string | null | undefined,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<CallResult> {
  const started = Date.now();
  const cfg = aiConfig(userId);
  if (!cfg.apiKey) {
    return { text: null, error: { message: "未配置 API Key" }, httpOk: false, latencyMs: 0 };
  }

  const url = `${cfg.baseUrl}/chat/completions`;
  const retries = opts.retries ?? MAX_RETRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let useCompletionTokens = false;
  let omitTemperature = false;
  let compatRetries = 0;
  const MAX_COMPAT_RETRIES = 2; // max_tokens 兼容 + temperature 兼容，各允许一次
  let retriesUsed = 0;
  let lastError: AiCallError | null = null;

  // 最多尝试次数 = 1 次正常请求 + retries 次重试 + 最多 2 次参数兼容重试
  const maxTries = retries + 1 + MAX_COMPAT_RETRIES;

  for (let attempt = 0; attempt < maxTries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const payload: Record<string, unknown> = {
        model: opts.model ?? cfg.model,
        messages,
      };
      // 部分推理模型（o1 / o3 / gpt-5 等）不接受自定义 temperature
      if (!omitTemperature) payload.temperature = opts.temperature ?? 0.4;
      if (useCompletionTokens) payload.max_completion_tokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
      else payload.max_tokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const raw = await res.text();

      if (!res.ok) {
        // 兼容性重试（不占用普通重试配额，最多各一次）：
        // ① 部分推理模型要求 max_completion_tokens 而非 max_tokens
        // ② 部分推理模型不接受自定义 temperature
        if (res.status === 400 && compatRetries < MAX_COMPAT_RETRIES) {
          if (!useCompletionTokens && /max_completion_tokens|max_tokens/i.test(raw)) {
            useCompletionTokens = true;
            compatRetries++;
            console.error("[ai] 该模型要求 max_completion_tokens，已自动改用后重试");
            continue;
          }
          if (!omitTemperature && /temperature/i.test(raw)) {
            omitTemperature = true;
            compatRetries++;
            console.error("[ai] 该模型不接受自定义 temperature，已去掉该参数重试");
            continue;
          }
        }
        lastError = { message: describeHttpError(res.status, raw), status: res.status };
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && retriesUsed < retries) {
          console.error("[ai] 可重试错误，", res.status, "，第", retriesUsed + 1, "次重试");
          retriesUsed++;
          await sleep(backoffMs(retriesUsed - 1));
          continue;
        }
        console.error("[ai] chat completion failed:", res.status, raw.slice(0, 500));
        return { text: null, error: lastError, httpOk: false, latencyMs: Date.now() - started };
      }

      let data: { choices?: { message?: { content?: unknown }; finish_reason?: string }[] };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        return {
          text: null,
          error: { message: "接口返回的不是合法 JSON" },
          httpOk: true,
          latencyMs: Date.now() - started,
        };
      }

      const content = data.choices?.[0]?.message?.content;
      const text = typeof content === "string" ? content.trim() : "";
      if (!text) {
        const reason = data.choices?.[0]?.finish_reason ?? "unknown";
        console.error("[ai] empty content, finish_reason:", reason);
        return {
          text: null,
          error: {
            message: `模型返回空内容（finish_reason=${reason}）。推理类模型会消耗大量 token 思考，可调大 AI_MAX_TOKENS`,
          },
          httpOk: true,
          latencyMs: Date.now() - started,
        };
      }
      return { text, error: null, httpOk: true, latencyMs: Date.now() - started };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      lastError = { message: aborted ? `请求超时（${Math.round(timeoutMs / 1000)} 秒）` : err instanceof Error ? err.message : String(err) };
      // 超时通常意味着模型/网络卡住，重试意义不大，避免请求叠加
      if (!aborted && retriesUsed < retries) {
        retriesUsed++;
        await sleep(backoffMs(retriesUsed - 1));
        continue;
      }
      console.error("[ai] chat completion error:", err);
      return { text: null, error: lastError, httpOk: false, latencyMs: Date.now() - started };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    text: null,
    error: lastError ?? { message: "未知错误" },
    httpOk: false,
    latencyMs: Date.now() - started,
  };
}

/** 调用聊天补全接口，返回文本；未配置 Key 或出错时返回 null（由调用方降级）。 */
export async function chatCompletion(
  userId: string | null | undefined,
  messages: ChatMessage[],
  opts: ChatOptions = {}
): Promise<string | null> {
  const result = await callChat(userId, messages, opts);
  return result.text;
}

/** 调用聊天接口并要求结构化 JSON 输出，通过 zod schema 校验。 */
export async function chatCompletionJSON<T extends z.ZodTypeAny>(
  userId: string | null | undefined,
  schema: T,
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<z.infer<T> | null> {
  const cfg = aiConfig(userId);
  if (!cfg.apiKey) return null;

  // 合并所有 system 消息（避免丢弃后续 system 指令）
  const systemText = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const finalMessages: ChatMessage[] = [
    {
      role: "system",
      content: `${systemText}\n只输出合法 JSON，不要包含任何解释或 Markdown 代码块标记。`.trim(),
    },
    ...messages.filter((m) => m.role !== "system"),
  ];

  const attempt = async (maxTokens: number): Promise<{ data: z.infer<T> | null; error: AiCallError | null }> => {
    const r = await callChat(userId, finalMessages, {
      model: opts.model,
      temperature: opts.temperature ?? 0.2,
      maxTokens,
    });
    if (!r.text) return { data: null, error: r.error };
    const parsed = extractJSON(r.text);
    if (parsed == null) {
      console.error("[ai] JSON 解析失败，原始输出前 300 字:", r.text.slice(0, 300));
      return { data: null, error: { message: "模型输出不是合法 JSON" } };
    }
    const result = schema.safeParse(parsed);
    if (!result.success) {
      console.error("[ai] schema validation failed:", result.error.issues);
      return { data: null, error: { message: "模型输出未通过结构校验" } };
    }
    return { data: result.data as z.infer<T>, error: null };
  };

  const tokenBudget = opts.maxTokens ?? EXTRACT_MAX_TOKENS;
  const first = await attempt(tokenBudget);
  if (first.data) return first.data;

  // 仅当错误确实与「输出 token 上限」相关时，才用更保守的上限重试一次，
  // 避免模型名错误 / temperature 不支持等 400 造成无意义的重复调用。
  if (tokenBudget > 4096 && looksLikeTokenLimitError(first.error)) {
    console.error("[ai] 输出上限可能过高，使用 4096 重试一次");
    const fallback = await attempt(4096);
    if (fallback.data) return fallback.data;
  }
  return null;
}

/** 判断错误是否与「输出 token 上限」相关，用于决定是否降级重试。 */
function looksLikeTokenLimitError(err: AiCallError | null): boolean {
  if (!err || err.status !== 400) return false;
  return /max_tokens|max_completion_tokens|too large|exceed|maximum|超出|上限|最大/i.test(err.message);
}

export interface AiTestResult {
  ok: boolean;
  message: string;
  baseUrl: string;
  model: string;
  latencyMs: number;
  /** 配置来源：user = 用户界面，env = 环境变量，none = 未配置 */
  source: "user" | "env" | "none";
}

/**
 * 测试当前用户的 AI 配置是否可用。
 * 只要 HTTP 层成功即视为连接正常（推理模型可能因 token 不足返回空内容）。
 */
export async function testAiConnection(userId: string): Promise<AiTestResult> {
  const cfg = aiConfig(userId);
  const settings = getUserSettings(userId);
  const source: AiTestResult["source"] = settings?.ai_api_key?.trim()
    ? "user"
    : process.env.AI_API_KEY?.trim()
      ? "env"
      : "none";

  if (!cfg.apiKey) {
    return { ok: false, message: "未配置 API Key", baseUrl: cfg.baseUrl, model: cfg.model, latencyMs: 0, source };
  }

  const result = await callChat(
    userId,
    [
      { role: "system", content: "你是连通性测试助手。" },
      { role: "user", content: "请只回复两个字符：OK" },
    ],
    { temperature: 0, maxTokens: 256, timeoutMs: Math.min(DEFAULT_TIMEOUT_MS, 60_000), retries: 0 }
  );

  if (result.httpOk) {
    return {
      ok: true,
      message: `连接成功（${result.latencyMs} ms）`,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      latencyMs: result.latencyMs,
      source,
    };
  }
  return {
    ok: false,
    message: result.error?.message ?? "连接失败",
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    latencyMs: result.latencyMs,
    source,
  };
}

function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // 尝试剥离 Markdown 代码块
    const m = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1].trim());
      } catch {
        return null;
      }
    }
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
