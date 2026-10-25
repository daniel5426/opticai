import React from "react";
import { SiteHeader } from "@/components/site-header";
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

interface ExamLoadingStateProps {
  actions?: React.ReactNode;
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function ExamLoadingState({
  actions,
  activeTab,
  onTabChange,
}: ExamLoadingStateProps) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  return (
    <>
      <SiteHeader
        title={t("clients")}
        backLink="/clients"
        tabs={{ activeTab, onTabChange }}
      />
      <ClientSpaceLayout>
        <div
          className="no-scrollbar flex h-full min-h-0 flex-1 flex-col overflow-hidden p-4 lg:p-5"
          dir={direction}
          aria-busy="true"
        >
          {actions && (
            <fieldset disabled className="mb-2 flex shrink-0 items-center justify-end gap-2 opacity-50">
              {actions}
            </fieldset>
          )}
          <Skeleton className="min-h-0 w-full flex-1 rounded-lg" aria-hidden="true" />
        </div>
      </ClientSpaceLayout>
    </>
  );
}

interface ExamNotFoundStateProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function ExamNotFoundState({
  activeTab,
  onTabChange,
}: ExamNotFoundStateProps) {
  const { t } = useTranslation();
  return (
    <>
      <SiteHeader
        title={t("clients")}
        backLink="/clients"
        tabs={{ activeTab, onTabChange }}
      />
      <ClientSpaceLayout>
        <div className="flex h-full flex-col items-center justify-center">
          <h1 className="text-2xl">{t("examNotFound")}</h1>
        </div>
      </ClientSpaceLayout>
    </>
  );
}
