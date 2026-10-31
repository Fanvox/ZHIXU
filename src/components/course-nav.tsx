"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function CourseNav({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const tabs = [
    { href: `/courses/${courseId}`, label: t("course.overview"), exact: true },
    { href: `/courses/${courseId}/graph`, label: t("course.graph"), exact: false },
    { href: `/courses/${courseId}/tutor`, label: t("course.tutor"), exact: false },
    { href: `/courses/${courseId}/quiz`, label: t("course.quiz"), exact: false },
    { href: `/courses/${courseId}/path`, label: t("course.path"), exact: false },
  ];
  return (
    <div className="scrollbar-thin flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
