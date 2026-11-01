import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listDocuments, createDocument, getDocument, getCourse } from "@/lib/db/repo";
import { storeUpload, processDocument } from "@/lib/services/documents";
import { mimeToKind } from "@/lib/parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ courseId: string }> };

const MAX_SIZE = (Number(process.env.MAX_UPLOAD_SIZE_MB) || 100) * 1024 * 1024;

export async function GET(_req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);
    return withDb(() => {
      const course = getCourse(courseId);
      if (!course) return error("课程不存在", 404);
      if (course.owner_id !== user.id) return error("无权访问", 403);
      return json(listDocuments(courseId));
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { courseId } = await params;
    const user = await requireUser();
    if (!user) return error("未登录", 401);

    const course = withDb(() => getCourse(courseId));
    if (!course) return error("课程不存在", 404);
    if (course.owner_id !== user.id) return error("无权访问", 403);

    const form = await req.formData().catch(() => null);
    if (!form) return error("请求格式错误：需要 multipart/form-data");
    const file = form.get("file");
    if (!(file instanceof File)) return error("请上传文件");

    const filename = file.name || "未命名文件";
    const mime = file.type || "application/octet-stream";
    if (mimeToKind(mime) == null) {
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext !== "pdf" && ext !== "md" && ext !== "txt") {
        return error("不支持的文件格式，仅支持 PDF / DOCX / PPTX / TXT / Markdown");
      }
    }
    if (file.size > MAX_SIZE) return error(`文件过大，限制为 ${MAX_SIZE / 1024 / 1024}MB`);
    if (file.size === 0) return error("文件为空");

    const bytes = new Uint8Array(await file.arrayBuffer());

    const doc = withDb(() =>
      createDocument({
        course_id: courseId,
        filename,
        mime_type: mime,
        size_bytes: file.size,
      })
    );

    await storeUpload(doc.id, filename, mime, bytes);
    const result = await processDocument(doc.id, user.id);

    return json(
      {
        document: getDocument(doc.id),
        extraction: {
          node_count: result.nodes.length,
          edge_count: result.edges.length,
          mode: result.mode,
        },
      },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
