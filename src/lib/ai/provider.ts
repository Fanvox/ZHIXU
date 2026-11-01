// AI Provider 抽象 —— 统一封装 OpenAI-compatible 接口。
// 未配置 API Key 时返回 null，由调用方降级到内置演示引擎（demo.ts）。
// 配置优先级：用户界面配置（user_settings）> 环境变量 > 默认值。
import { z } from "zod";
import { getUserSettings } from "../db/repo";

export interface AiConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  extractModel: string;
}

function envConfig(): AiConfig {
  return {
    apiKey: process.env.AI_API_KEY?.trim() ?? "",
    baseUrl: (process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.AI_MODEL?.trim() || "gpt-4o-mini",
    extractModel: (process.env.AI_EXTRACT_MODEL?.trim() || process.env.AI_MODEL?.trim() || "gpt-4o-mini"),
  };
}

export function aiConfig(userId?: string | null): AiConfig {
  const env = envConfig();
  if (userId) {
    const s = getUserSettings(userId);
    if (s) {
      return {
        apiKey: (s.ai_api_key?.trim() || env.apiKey),
        baseUrl: (s.ai_base_url?.trim() || env.baseUrl).replace(/\/+$/, ""),
        model: s.ai_model?.trim() || env.model,
        extractModel: s.ai_extract_model?.trim() || env.extractModel,
      };
    }
  }
  return env;
}

export function isAIEnabled(userId?: string | null): boolean {
  return aiConfig(userId).apiKey.length > 0;
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 调用聊天补全接口，返回文本；未配置 Key 或出错时返回 null。 */
export async function chatCompletion(
  userId: string | null | undefined,
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string | null> {
  const cfg = aiConfig(userId);
  if (!cfg.apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 300_000);
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model ?? cfg.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[ai] chat completion failed:", res.status, await safeText(res));
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (err) {
    console.error("[ai] chat completion error:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 调用聊天接口并要求结构化 JSON 输出，通过 zod schema 校验。 */
export async function chatCompletionJSON<T extends z.ZodTypeAny>(
  userId: string | null | undefined,
  schema: T,
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {}
): Promise<z.infer<T> | null> {
  const cfg = aiConfig(userId);
  if (!cfg.apiKey) return null;

  const sysPrompt = messages[0]?.role === "system" ? messages[0].content : "";
  const res = await chatCompletion(
    userId,
    [
      { role: "system", content: `${sysPrompt}\n只输出合法 JSON，不要包含任何解释或 Markdown 代码块标记。` },
      ...messages.filter((m) => m.role !== "system"),
    ],
    { model: opts.model, temperature: opts.temperature ?? 0.2, maxTokens: 16000 }
  );
  if (res == null) return null;

  const parsed = extractJSON(res);
  if (parsed == null) return null;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error("[ai] schema validation failed:", result.error.issues);
    return null;
  }
  return result.data;
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

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
