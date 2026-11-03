"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Sparkles, Plus, FileText, Network, Bot, User, X, Trash2, ChevronDown } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseNav } from "@/components/course-nav";
import { MiniMarkdown } from "@/components/markdown";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { KnowledgeNode, SourceRef } from "@/lib/types";

interface Session { id: string; title: string; updated_at: string }
interface Msg { role: "user" | "assistant"; content: string; sources?: SourceRef[]; nodeRefs?: string[] }

export default function TutorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const sessions = useFetch<Session[]>(`/api/courses/${courseId}/chat`);
  const nodes = useFetch<KnowledgeNode[]>(`/api/courses/${courseId}/nodes`);
  const { t } = useI18n();

  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** 图谱页「问 AI 导师」带入的知识点 */
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const nodeNames = new Map((nodes.data ?? []).map((n) => [n.id, n.name]));
  const selectedNodeName = selectedNodeId ? nodeNames.get(selectedNodeId) : undefined;

  // 从 URL 读取 ?node=（图谱页跳转）。这里不用 useSearchParams，
  // 以避免客户端页面必须被 Suspense 包裹（Next.js 的 useSearchParams 限制）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nodeId = new URLSearchParams(window.location.search).get("node");
    if (nodeId) setSelectedNodeId(nodeId);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function selectSession(id: string) {
    setSessionId(id);
    setLoadingMsgs(true);
    try {
      const msgs = await api.get<{ role: string; content: string; sources: SourceRef[]; node_refs: string[]; created_at: string }[]>(`/api/chat/${id}`);
      setMessages(msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content, sources: m.sources, nodeRefs: m.node_refs })));
    } catch {
      toast({ title: t("tutor.loadFailed"), variant: "error" });
    } finally {
      setLoadingMsgs(false);
    }
  }

  function newChat() {
    setSessionId("");
    setMessages([]);
    clearNodeContext();
  }

  function clearNodeContext() {
    setSelectedNodeId("");
    router.replace(`/courses/${courseId}/tutor`);
  }

  async function deleteSession() {
    if (!sessionId) return;
    if (typeof window !== "undefined" && !window.confirm(t("tutor.deleteSessionConfirm"))) return;
    setDeleting(true);
    try {
      await api.del(`/api/chat/${sessionId}`);
      toast({ title: t("tutor.sessionDeleted"), variant: "success" });
      setSessionId("");
      setMessages([]);
      sessions.reload({ silent: true });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : t("toast.saveFailed"), variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  async function send() {
    const q = input.trim();
    if (!q || sending) return;
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    try {
      const res = await api.post<{ session_id: string; reply: { content: string; sources: SourceRef[]; nodeRefs: string[]; mode: string } }>(
        `/api/courses/${courseId}/chat`,
        { question: q, session_id: sessionId || undefined, selected_node_id: selectedNodeId || undefined }
      );
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply.content, sources: res.reply.sources, nodeRefs: res.reply.nodeRefs },
      ]);
      sessions.reload({ silent: true });
    } catch (e) {
      // 失败时不伪造助手消息，改为提示并把问题放回输入框，方便重试
      toast({ title: e instanceof Error ? e.message : t("tutor.sendFailed"), variant: "error" });
      setMessages((prev) => prev.slice(0, -1));
      setInput(q);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <CourseNav courseId={courseId} />

      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{t("tutor.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tutor.subtitle")}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {sessionId && (
            <Button variant="ghost" size="sm" onClick={deleteSession} disabled={deleting} title={t("tutor.deleteSession")}>
              {deleting ? <Spinner /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="outline" onClick={newChat}>
            <Plus className="h-4 w-4" /> {t("tutor.newChat")}
          </Button>
        </div>
      </div>

      {/* 会话列表 */}
      {sessions.data && sessions.data.length > 0 && (
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
          {sessions.data.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSession(s.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
                s.id === sessionId ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
            >
              {s.title.slice(0, 20)}
            </button>
          ))}
        </div>
      )}

      <Card className="flex flex-col overflow-hidden">
        {/* Messages */}
        <div ref={scrollRef} className="scrollbar-thin h-[56vh] overflow-y-auto p-4">
          {loadingMsgs && <Skeleton className="h-20 w-full" />}
          {!loadingMsgs && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium">{t("tutor.emptyTitle")}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("tutor.emptyDesc")}</p>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} nodeNames={nodeNames} courseId={courseId} />
          ))}
          {sending && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Bot className="h-4 w-4" /> <Spinner /> {t("tutor.thinking")}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="space-y-2 border-t p-3">
          {selectedNodeId && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
              <Network className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="flex-1 truncate">
                {t("tutor.nodeContext", { name: selectedNodeName ?? t("tutor.nodeFallback") })}
              </span>
              <button
                type="button"
                onClick={clearNodeContext}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("tutor.clearNodeContext")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={t("tutor.placeholder")}
              rows={2}
              className="resize-none"
            />
            <Button onClick={send} disabled={sending || !input.trim()} className="h-14 px-4">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ msg, nodeNames, courseId }: { msg: Msg; nodeNames: Map<string, string>; courseId: string }) {
  const { t } = useI18n();
  const isUser = msg.role === "user";
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleSource(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className={cn("mb-4 flex gap-3", isUser && "flex-row-reverse")}>
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", isUser ? "bg-muted" : "bg-primary/10 text-primary")}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("max-w-[85%] rounded-xl px-3.5 py-2.5", isUser ? "bg-primary text-primary-foreground" : "bg-muted/60")}>
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
        ) : (
          <>
            <MiniMarkdown text={msg.content} />
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-3 space-y-1 border-t pt-2">
                {msg.sources.map((s, i) => (
                  <div key={i} className="rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleSource(i)}
                      className="flex w-full items-center gap-1 text-left"
                      title={t("tutor.expandSnippet")}
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {s.document_name}
                        {s.page != null && ` · ${t("course.chunkPage", { n: s.page })}`}
                      </span>
                      {s.snippet && (
                        <ChevronDown className={cn("ml-auto h-3 w-3 shrink-0 transition-transform", expanded.has(i) && "rotate-180")} />
                      )}
                    </button>
                    {expanded.has(i) && s.snippet && (
                      <p className="mt-1 border-l-2 border-primary/30 pl-2 leading-relaxed">{s.snippet}…</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {msg.nodeRefs && msg.nodeRefs.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
                <span className="text-[11px] text-muted-foreground">{t("tutor.relatedNodes")}</span>
                {msg.nodeRefs.slice(0, 5).map((id) => (
                  <Link
                    key={id}
                    href={`/courses/${courseId}/graph?node=${id}`}
                    className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-[11px] font-medium text-accent-foreground hover:underline"
                  >
                    <Network className="h-3 w-3" /> {nodeNames.get(id) ?? t("tutor.nodeFallback")}
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
