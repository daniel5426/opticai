import React from "react";
import { useTranslation } from "react-i18next";
import type { SoftopticTabKey, SoftopticTabView } from "@/lib/softoptic-exam-tabs";
import { Root, List, Trigger } from "@radix-ui/react-tabs";
import { useAppLocale } from "@/localization/use-app-locale";
import { examLayoutFolderTabStyle } from "./ExamLayoutTabs";

interface Props {
  tabs: SoftopticTabView[];
  activeTab: SoftopticTabKey | null;
  onTabChange: (tab: SoftopticTabKey) => void;
}

export function SoftopticExamTabs({ tabs, activeTab, onTabChange }: Props) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  return (
    <Root value={activeTab ?? ""} onValueChange={key => onTabChange(key as SoftopticTabKey)} activationMode="manual" dir={direction}>
      <List aria-label={t("softoptic.examTabs.label")} className="flex items-end gap-0.5">
        {tabs.map(({ key }) => (
          <Trigger key={key} value={key}
            className="focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2"
            style={examLayoutFolderTabStyle(activeTab === key)}>
            {t(`softoptic.examTabs.${key}`)}
          </Trigger>
        ))}
      </List>
    </Root>
  );
}
