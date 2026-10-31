"use client";

import type { MasteryStatus } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { I18nKey } from "@/lib/i18n/dictionaries";

export const MASTERY_META: Record<
  MasteryStatus,
  { dot: string; badge: string; labelKey: I18nKey }
> = {
  mastered: {
    dot: "bg-mastered",
    badge: "border-mastered/30 bg-mastered/10 text-mastered",
    labelKey: "mastery.mastered",
  },
  learning: {
    dot: "bg-learning",
    badge: "border-learning/30 bg-learning/10 text-learning",
    labelKey: "mastery.learning",
  },
  review: {
    dot: "bg-review",
    badge: "border-review/30 bg-review/10 text-review",
    labelKey: "mastery.review",
  },
  untouched: {
    dot: "bg-untouched",
    badge: "border-untouched/30 bg-untouched/10 text-untouched",
    labelKey: "mastery.untouched",
  },
};

export function MasteryDot({ status, className }: { status: MasteryStatus; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", MASTERY_META[status].dot, className)} />;
}

export function MasteryBadge({ status }: { status: MasteryStatus }) {
  const { t } = useI18n();
  const m = MASTERY_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", m.badge)}>
      <MasteryDot status={status} />
      {t(m.labelKey)}
    </span>
  );
}

export function MasteryLegend() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {(Object.keys(MASTERY_META) as MasteryStatus[]).map((s) => (
        <div key={s} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MasteryDot status={s} />
          {t(MASTERY_META[s].labelKey)}
        </div>
      ))}
    </div>
  );
}
