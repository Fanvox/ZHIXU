// 文档解析器 —— 将上传文件解析为带页码/章节信息的分块文本。
// 第一阶段重点保证 PDF 解析质量，DOCX/PPTX/TXT/MD 同步支持。

export type DocKind = "pdf" | "docx" | "pptx" | "txt" | "md";

export interface ParsedChunk {
  content: string;
  page_start: number | null;
  page_end: number | null;
  section: string | null;
}

export interface ParseResult {
  page_count: number | null;
  chunks: ParsedChunk[];
  full_text: string;
}

export const SUPPORTED_MIME: Record<DocKind, string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/x-markdown"],
};

/** 扩展名 → 文档类型（浏览器/系统未注册 MIME 时（常见为 application/octet-stream）的兜底） */
const EXT_TO_KIND: Record<string, DocKind> = {
  pdf: "pdf",
  docx: "docx",
  pptx: "pptx",
  ppt: "pptx",
  txt: "txt",
  md: "md",
  markdown: "md",
};

const KIND_TO_MIME: Record<DocKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
};

export function mimeToKind(mime: string): DocKind | null {
  const lower = (mime || "").toLowerCase();
  for (const [kind, mimes] of Object.entries(SUPPORTED_MIME) as [DocKind, string[]][]) {
    if (mimes.includes(lower)) return kind;
  }
  return null;
}

/** 按扩展名推断文档类型。 */
export function kindFromFilename(filename: string): DocKind | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_KIND[ext] ?? null;
}

/** 该文档类型对应的标准 MIME（用于规范化存储，便于前端展示）。 */
export function canonicalMimeForKind(kind: DocKind): string {
  return KIND_TO_MIME[kind];
}

export async function parseDocument(data: Uint8Array, mime: string, filename: string): Promise<ParseResult> {
  // 优先用 MIME，其次用扩展名兜底（避免 octet-stream 直接把 docx/pptx 判为不支持）
  const kind = mimeToKind(mime) ?? kindFromFilename(filename);
  if (!kind) {
    const ext = filename.split(".").pop()?.toLowerCase();
    throw new Error(`暂不支持的文件格式：${ext ? "." + ext : mime || "未知"}`);
  }

  switch (kind) {
    case "pdf":
      return parsePdf(data);
    case "docx":
      return parseDocx(data);
    case "pptx":
      return parsePptx(data);
    case "txt":
    case "md":
      return parseText(data);
  }
}

async function parsePdf(data: Uint8Array): Promise<ParseResult> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(data);
  const result = await extractText(pdf, { mergePages: false });
  const totalPages = result.totalPages ?? 0;
  const pages: string[] = Array.isArray(result.text) ? result.text : [result.text as string];

  const chunks: ParsedChunk[] = [];
  let full = "";
  for (let i = 0; i < pages.length; i++) {
    const pageText = pages[i] ?? "";
    full += pageText + "\n";
    const section = detectSection(pageText);
    for (const c of chunkText(pageText)) {
      chunks.push({ content: c, page_start: i + 1, page_end: i + 1, section });
    }
  }
  return { page_count: totalPages || pages.length || null, chunks, full_text: full };
}

async function parseDocx(data: Uint8Array): Promise<ParseResult> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: data as unknown as Buffer });
  const text = result.value;
  const chunks = chunkText(text).map((c) => ({
    content: c,
    page_start: null,
    page_end: null,
    section: detectSection(c),
  }));
  return { page_count: null, chunks, full_text: text };
}

async function parsePptx(data: Uint8Array): Promise<ParseResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(data as unknown as Buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml$/)![1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml$/)![1], 10);
      return na - nb;
    });
  const chunks: ParsedChunk[] = [];
  let full = "";
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const texts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]);
    const slideText = texts
      .join("\n")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
    full += slideText + "\n";
    for (const c of chunkText(slideText)) {
      chunks.push({ content: c, page_start: i + 1, page_end: i + 1, section: detectSection(slideText) });
    }
  }
  return { page_count: slideFiles.length || null, chunks, full_text: full };
}

/**
 * 文本解码：默认 UTF-8；若出现大量替换字符（乱码），自动尝试 GBK/GB18030。
 * 国内用户用记事本保存的 .txt 常是 GBK 编码。
 */
export function decodeText(data: Uint8Array): string {
  let utf8 = "";
  try {
    utf8 = new TextDecoder("utf-8").decode(data);
  } catch {
    utf8 = "";
  }
  const bad = (utf8.match(/\uFFFD/g) ?? []).length;
  if (bad > 0 && bad / Math.max(1, utf8.length) > 0.005) {
    for (const enc of ["gb18030", "gbk"]) {
      try {
        const decoded = new TextDecoder(enc).decode(data);
        const badGbk = (decoded.match(/\uFFFD/g) ?? []).length;
        if (badGbk < bad) return decoded;
      } catch {
        // 运行环境不支持该编码则跳过
      }
    }
  }
  return utf8;
}

async function parseText(data: Uint8Array): Promise<ParseResult> {
  const text = decodeText(data);
  const chunks = chunkText(text).map((c) => ({
    content: c,
    page_start: null,
    page_end: null,
    section: detectSection(c),
  }));
  return { page_count: null, chunks, full_text: text };
}

/** 将文本按段落切分为约 900 字符的分块，尽量保留句子完整。 */
export function chunkText(text: string, target = 900): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "");
  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + " " + p).length > target && current.length > 0) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n" + p : p;
    }
    // 处理超长段落
    while (current.length > target * 1.5) {
      const cut = current.slice(0, target);
      const lastStop = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("."), cut.lastIndexOf("；"));
      const splitAt = lastStop > target * 0.4 ? lastStop + 1 : target;
      chunks.push(current.slice(0, splitAt).trim());
      current = current.slice(splitAt).trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** 探测章节标题（中文章节/Chapter/数字编号标题）。 */
function detectSection(text: string): string | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 4)) {
    const m =
      line.match(/^第\s*[一二三四五六七八九十0-9]+\s*[章节讲部分]/) ||
      line.match(/^Chapter\s+\d+/i) ||
      line.match(/^\d+(\.\d+)*[\s、.]*\S{2,}/);
    if (m && line.length <= 60) return line.slice(0, 60);
  }
  return null;
}
