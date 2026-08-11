import React from "react";
import { SiteHeader } from "@/components/site-header";
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

interface ExamLoadingStateProps {
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function ExamLoadingState({
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
          className="no-scrollbar mb-10 flex flex-1 flex-col p-4 lg:p-5"
          dir={direction}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="mb-6">
            <Card className="examcard bg-background w-full rounded-xl px-4 py-3">
              <div
                className="no-scrollbar flex w-full items-end gap-2 overflow-x-auto whitespace-nowrap"
                dir={direction}
                style={{ scrollbarWidth: "none" }}
              >
                <div className="flex w-full max-w-[180px] min-w-[100px] flex-1 flex-col gap-1 sm:w-[180px]">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>

                <div className="flex w-full max-w-[120px] min-w-[80px] flex-1 flex-col gap-1 sm:w-[120px]">
                  <Skeleton className="h-3 w-12 rounded" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>

                <div className="flex w-full max-w-[180px] min-w-[100px] flex-1 flex-col gap-1 sm:w-[180px]">
                  <Skeleton className="h-3 w-10 rounded" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
                <div className="flex w-full max-w-[120px] min-w-[80px] flex-1 flex-col gap-1 sm:w-[120px]">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
                <div className="flex-1" />
                <div className="flex min-w-0 items-center gap-2 self-center">
                  <Skeleton className="h-9 w-1/3 max-w-[96px] min-w-[56px] rounded-lg" />
                  <Skeleton className="h-9 w-1/3 max-w-[96px] min-w-[56px] rounded-lg" />
                  <Skeleton className="h-9 w-1/5 max-w-[40px] min-w-[32px] rounded-lg" />
                </div>
              </div>
            </Card>
          </div>
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-10 w-20 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="w-full">
                <div className="flex gap-4" dir="ltr">
                  <Skeleton className="h-40 w-full" />
                </div>
              </div>
            ))}
          </div>
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
