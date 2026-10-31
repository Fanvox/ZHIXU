"use client";

import { cn } from "@/lib/utils";

/** 极简 Markdown 渲染：支持 ```code```、`inline`、**bold**、> 引用、换行与列表。 */
export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className={cn("space-y-2 text-sm leading-relaxed", className)}>
      {blocks.map((block, i) => {
        if (block.startsWith("```")) {
          const code = block.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trimEnd();
          return (
            <pre key={i} className="scrollbar-thin overflow-x-auto rounded-lg bg-muted p-3 text-xs">
              <code className="font-mono">{code}</code>
            </pre>
          );
        }
        return block.split(/\n/).map((line, j) => {
          if (!line.trim()) return <div key={`${i}-${j}`} className="h-1.5" />;
          if (line.trim().startsWith("> ")) {
            return (
              <blockquote key={`${i}-${j}`} className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
                {renderInline(line.replace(/^>\s?/, ""))}
              </blockquote>
            );
          }
          if (/^[-*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim())) {
            return (
              <div key={`${i}-${j}`} className="flex gap-2 pl-1">
                <span className="text-muted-foreground">•</span>
                <span>{renderInline(line.replace(/^[-*]\s/, "").replace(/^\d+\.\s/, ""))}</span>
              </div>
            );
          }
          return <p key={`${i}-${j}`}>{renderInline(line)}</p>;
        });
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{p.slice(1, -1)}</code>;
    }
    return <span key={i}>{p}</span>;
  });
}
