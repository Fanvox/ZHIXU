"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
      aria-label="切换语言 / Switch language"
      className="font-mono text-xs"
    >
      <Languages className="h-4 w-4" />
    </Button>
  );
}
