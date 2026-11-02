import { json, error, withDb, requireUser, handleError } from "@/lib/http";
import { listDocuments, createDocument, getDocument, getCourse, findDocumentByFilenameAndSize } from "@/lib/db/repo";
import { storeUpload } from "@/lib/services/documents";
import { enqueueDocument, getQueueSnapshot } from "@/lib/services/jobs";
import { canonicalMimeForKind, kindFromFilename, mimeToKind } from "@/lib/parser";

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

      // 附加后台队列信息，便于前端展示「正在处理 / 排队第 N 位」
      const snapshot = getQueueSnapshot();
      const docs = listDocuments(courseId).map((d) => {
        const idx = snapshot.queued.indexOf(d.id);
        return {
          ...d,
          is_processing: snapshot.processing.includes(d.id),
          queue_position: d.status === "pending" && idx >= 0 ? idx + 1 : null,
        };
      });
      return json(docs);
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
    const rawMime = file.type || "application/octet-stream";

    // MIME 可能缺失（浏览器/系统未注册），用扩展名兜底，避免误拒 docx / pptx
    const kind = mimeToKind(rawMime) ?? kindFromFilename(filename);
    if (!kind) {
      return error("不支持的文件格式，仅支持 PDF / DOCX / PPTX / TXT / Markdown");
    }
    const mime = canonicalMimeForKind(kind);

    if (file.size > MAX_SIZE) return error(`文件过大，限制为 ${MAX_SIZE / 1024 / 1024}MB`);
    if (file.size === 0) return error("文件为空");

    // 重复上传检测：同课程下同名且同大小
    const dup = withDb(() => findDocumentByFilenameAndSize(courseId, filename, file.size));
    if (dup) {
      return error(
        `该文件已上传过（同名同大小，状态：${dup.status}）。如需重新解析请使用列表中的「重新处理」，或先删除旧记录`,
        409
      );
    }

    const doc = withDb(() =>
      createDocument({
        course_id: courseId,
        filename,
        mime_type: mime,
        size_bytes: file.size,
      })
    );

    // 流式写入磁盘，避免大文件整体进内存
    await storeUpload(doc.id, filename, mime, file.stream());
    // 立即返回，解析与知识抽取在后台队列中执行；前端轮询文档状态
    enqueueDocument(doc.id, user.id);

    return json({ document: getDocument(doc.id), queued: true }, 201);
  } catch (e) {
    return handleError(e);
  }
}
