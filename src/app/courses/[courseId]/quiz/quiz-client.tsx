"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, Sparkles, Check, X, RotateCcw, Network } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";
import { useI18n } from "@/lib/i18n";
import type { I18nKey } from "@/lib/i18n/dictionaries";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseNav } from "@/components/course-nav";
import { MiniMarkdown } from "@/components/markdown";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { MasteryStatus, QuestionType, QuizView } from "@/lib/types";

interface GradedResult {
  score: number;
  correctCount: number;
  total: number;
  results: { questionId: string; correct: boolean; correctAnswer: string; userAnswer: string; explanation: string; nodeId: string | null; nodeName: string | null }[];
  masteryUpdates: { node_id: string; status: MasteryStatus | null }[];
}

const TYPE_LABEL: Record<QuestionType, I18nKey> = {
  single: "quiz.type.single",
  multiple: "quiz.type.multiple",
  true_false: "quiz.type.true_false",
  short_answer: "quiz.type.short_answer",
  code: "quiz.type.code",
};

export default function QuizPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const quizzes = useFetch<{ id: string; title: string; node_ids: string; created_at: string }[]>(`/api/courses/${courseId}/quiz`);
  const { t } = useI18n();

  const [quiz, setQuiz] = useState<QuizView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradedResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const focusNode = searchParams.get("node");

  async function generate(nodeIds?: string[]) {
    setGenerating(true);
    setResult(null);
    try {
      const res = await api.post<{ quizId: string; title: string; mode: string; questionCount: number }>(
        `/api/courses/${courseId}/quiz`,
        { node_ids: nodeIds, count: 5 }
      );
      const q = await api.get<QuizView>(`/api/quiz/${res.quizId}`);
      setQuiz(q);
      setAnswers({});
      if (res.mode === "demo") toast({ title: "已生成测验（演示引擎）", description: "未配置大模型，使用规则引擎出题", variant: "info" });
      else toast({ title: "测验已生成", variant: "success" });
      quizzes.reload();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "生成失败", variant: "error" });
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (focusNode) generate([focusNode]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNode]);

  async function loadQuiz(id: string) {
    setGenerating(true);
    setResult(null);
    try {
      const q = await api.get<QuizView>(`/api/quiz/${id}`);
      setQuiz(q);
      setAnswers({});
    } catch {
      toast({ title: "加载测验失败", variant: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    if (!quiz) return;
    const unanswered = quiz.questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) return toast({ title: `还有 ${unanswered.length} 题未作答`, variant: "error" });
    setSubmitting(true);
    try {
      const res = await api.post<GradedResult>(`/api/quiz/${quiz.id}`, { answers });
      setResult(res);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "提交失败", variant: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <CourseNav courseId={courseId} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">{t("quiz.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("quiz.subtitle")}</p>
        </div>
        <Button onClick={() => generate()} disabled={generating}>
          {generating ? <Spinner /> : <Sparkles className="h-4 w-4" />}
          {t("quiz.generate")}
        </Button>
      </div>

      {generating && !quiz && <Skeleton className="h-40 w-full" />}

      {!generating && !quiz && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("quiz.history")}</CardTitle>
            <CardDescription>{t("quiz.historyDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quizzes.data?.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("quiz.noHistory")}</p>
            )}
            {quizzes.data?.map((q) => (
              <button key={q.id} onClick={() => loadQuiz(q.id)} className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" /> {q.title}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString("zh-CN")}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {quiz && !result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{quiz.title}</CardTitle>
              <CardDescription>{t("quiz.questionsCount", { count: quiz.questions.length })}</CardDescription>
            </CardHeader>
          </Card>
          {quiz.questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              index={i}
              question={q}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuiz(null)}>返回</Button>
            <Button onClick={submit} disabled={submitting}>{submitting && <Spinner />}{t("quiz.submit")}</Button>
          </div>
        </div>
      )}

      {result && quiz && (
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="flex items-center gap-5">
                <div className={cn("flex h-20 w-20 items-center justify-center rounded-full border-4 text-2xl font-bold", result.score >= 80 ? "border-emerald-500 text-emerald-500" : result.score >= 60 ? "border-amber-500 text-amber-500" : "border-red-500 text-red-500")}>
                  {result.score}
                </div>
                <div>
                  <p className="text-lg font-semibold">{result.correctCount}/{result.total} 题正确</p>
                  <p className="text-sm text-muted-foreground">
                    {result.score >= 80 ? "掌握良好，继续保持！" : result.score >= 60 ? "基本掌握，注意薄弱环节。" : "需要复习，建议回到知识图谱巩固。"}
                  </p>
                  {result.masteryUpdates.filter((m) => m.status).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      已更新 {result.masteryUpdates.length} 个知识点的掌握状态
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setResult(null); setAnswers({}); }}>
                  <RotateCcw className="h-4 w-4" /> 再测一次
                </Button>
                <Button variant="outline" onClick={() => generate()}><Sparkles className="h-4 w-4" /> 新测验</Button>
              </div>
            </CardContent>
          </Card>

          {quiz.questions.map((q, i) => {
            const r = result.results.find((x) => x.questionId === q.id)!;
            return (
              <Card key={q.id} className={cn("border-l-4", r.correct ? "border-l-emerald-500" : "border-l-red-500")}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-2">
                    <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", r.correct ? "bg-emerald-500 text-white" : "bg-red-500 text-white")}>
                      {r.correct ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{i + 1}. {q.stem}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">{t(TYPE_LABEL[q.type])}</Badge>
                        {r.nodeName && <Badge variant="outline">{r.nodeName}</Badge>}
                      </div>
                      {!r.correct && (
                        <p className="mt-2 text-xs">
                          <span className="text-muted-foreground">你的答案：</span>
                          <span className="text-review">{formatAnswer(r.userAnswer, q, t)}</span>
                          <span className="ml-3 text-muted-foreground">{t("quiz.correctAnswer")}</span>
                          <span className="text-success">{formatAnswer(r.correctAnswer, q, t)}</span>
                        </p>
                      )}
                      {r.explanation && (
                        <div className="mt-2 rounded-lg bg-muted/50 p-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">解析</p>
                          <MiniMarkdown text={r.explanation} />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Network className="h-3.5 w-3.5" />
            掌握状态已同步到 <Link href={`/courses/${courseId}/graph`} className="text-primary hover:underline">知识图谱</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: QuizView["questions"][number];
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useI18n();
  const letters = question.options.map((_, i) => String.fromCharCode(65 + i));
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-2">
          <Badge variant="secondary" className="mt-0.5 shrink-0">{t(TYPE_LABEL[question.type])}</Badge>
          <p className="text-sm font-medium">{index + 1}. {question.stem}</p>
        </div>

        {(question.type === "single" || question.type === "multiple") && (
          <div className="mt-3 space-y-2">
            {question.options.map((opt, i) => {
              const letter = letters[i];
              const multi = question.type === "multiple";
              const selected = multi ? value.includes(letter) : value === letter;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (multi) {
                      const set = new Set(value.split("").filter(Boolean));
                      if (set.has(letter)) set.delete(letter); else set.add(letter);
                      onChange([...set].sort().join(""));
                    } else {
                      onChange(letter);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    selected ? "border-primary bg-accent" : "hover:bg-muted/50"
                  )}
                >
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-semibold", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                    {letter}
                  </span>
                  <span className="flex-1">{opt}</span>
                </button>
              );
            })}
          </div>
        )}

        {question.type === "true_false" && (
          <div className="mt-3 flex gap-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onChange(String.fromCharCode(65 + i))}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                  value === String.fromCharCode(65 + i) ? "border-primary bg-accent" : "hover:bg-muted/50"
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.type === "short_answer" && (
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="输入你的答案" className="mt-3" />
        )}

        {question.type === "code" && (
          <Textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder="输入答案（代码或结果）" rows={3} className="mt-3 font-mono" />
        )}
      </CardContent>
    </Card>
  );
}

function formatAnswer(answer: string, q: QuizView["questions"][number], t: (key: I18nKey) => string): string {
  if ((q.type === "single" || q.type === "multiple") && q.options.length > 0) {
    return answer
      .split("")
      .sort()
      .map((ch) => {
        const idx = ch.charCodeAt(0) - 65;
        return q.options[idx] ?? ch;
      })
      .join("、");
  }
  if (q.type === "true_false") return answer === "A" ? t("quiz.true") : answer === "B" ? t("quiz.false") : answer;
  return answer;
}
