"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Send, Sparkles, Plus, FileText, Network, Bot, User } from "lucide-react";
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
  const sessions = useFetch<Session[]>(`/api/courses/${courseId}/chat`);
  const nodes = useFetch<KnowledgeNode[]>(`/api/courses/${courseId}/nodes`);
  const { t } = useI18n();

  const [sessionId, setSessionId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nodeNames = new Map((nodes.data ?? []).map((n) => [n.id, n.name]));

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
      toast({ title: "加载会话失败", variant: "error" });
    } finally {
      setLoadingMsgs(false);
    }
  }

  function newChat() {
    setSessionId("");
    setMessages([]);
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
        { question: q, session_id: sessionId || undefined }
      );
      setSessionId(res.session_id);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply.content, sources: res.reply.sources, nodeRefs: res.reply.nodeRefs },
      ]);
      sessions.reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "发送失败", variant: "error" });
      setMessages((prev) => [...prev, { role: "assistant", content: "抱歉，暂时无法回答，请稍后再试。" }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <CourseNav courseId={courseId} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("tutor.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tutor.subtitle")}</p>
        </div>
        <Button variant="outline" onClick={newChat}>
          <Plus className="h-4 w-4" /> {t("tutor.newChat")}
        </Button>
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
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("tutor.emptyDesc")}
                </p>
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
        <div className="border-t p-3">
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
              <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2">
                {msg.sources.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    <FileText className="h-3 w-3" /> {s.document_name}
                    {s.page != null && ` · 第${s.page}页`}
                  </span>
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
                    <Network className="h-3 w-3" /> {nodeNames.get(id) ?? "知识点"}
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
