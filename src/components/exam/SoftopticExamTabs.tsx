import React from "react";
import { useTranslation } from "react-i18next";
import type { SoftopticTabKey, SoftopticTabView } from "@/lib/softoptic-exam-tabs";
import { cn } from "@/utils/tailwind";

interface Props {
  tabs: SoftopticTabView[];
  activeTab: SoftopticTabKey | null;
  onTabChange: (tab: SoftopticTabKey) => void;
}

/** OpticSoft's exam tabs for an imported SoftOptic exam; only tabs with data are listed. */
export function SoftopticExamTabs({ tabs, activeTab, onTabChange }: Props) {
  const { t, i18n } = useTranslation();
  return (
    <nav
      role="tablist"
      aria-label={t("softoptic.examTabs.label")}
      className="flex flex-wrap items-end gap-0.5"
      dir={i18n.dir()}
    >
      {/* Shown in the layout-tabs row, with the same folder tabs that join the exam card. */}
      {tabs.map(({ key }) => {
        const isActive = key === activeTab;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(key)}
            className={cn(
              "inline-flex items-center rounded-t-lg px-[18px] pt-2 pb-[9px] text-[15px] whitespace-nowrap transition-colors",
              isActive
                ? "bg-card text-foreground relative z-[1] font-semibold shadow-sm after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-card after:content-['']"
                : "text-muted-foreground/70 hover:text-foreground font-medium",
            )}
          >
            {t(`softoptic.examTabs.${key}`)}
          </button>
        );
      })}
    </nav>
  );
}
