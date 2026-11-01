import { Suspense } from "react";
import QuizClient from "./quiz-client";

// 用 Suspense 包裹使用 useSearchParams 的客户端组件，
// 避免 Next.js 出现 "React Client Manifest" 客户端渲染异常。
export default function QuizPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">加载中…</div>}>
      <QuizClient />
    </Suspense>
  );
}
