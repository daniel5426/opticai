import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { GuardedRouterLink } from "@/components/GuardedRouterLink";
import { examPageDataQueryKey, getExamPageData, getExamsByClientId } from "@/lib/db/exams-db";
import { clientQueryKeys } from "@/hooks/client/useClientTabQueries";
import type { OpticalExam } from "@/lib/db/schema-interface";
import { OPTITECH_EXAM_KINDS, groupOptitechExams, optitechExamKind, pickExamForTab } from "@/lib/optitech-exam-tabs";
import { cn } from "@/utils/tailwind";

interface Props {
  clientId: number;
  exam: OpticalExam;
}

/** OptiTech's client-card tabs (glasses, contact lenses, review, …) across a migrated client's exams. */
export function OptitechExamTabs({ clientId, exam }: Props) {
  const { t, i18n } = useTranslation();
  const activeKind = optitechExamKind(exam);
  const { data: exams = [], isSuccess } = useQuery({
    queryKey: clientQueryKeys.exams(clientId),
    queryFn: () => getExamsByClientId(clientId),
    enabled: Boolean(activeKind) && clientId > 0,
  });
  const groups = groupOptitechExams(exams);
  const queryClient = useQueryClient();
  // Warm the exams these tabs and arrows lead to, so switching swaps the page without reloading it.
  const targetIds = activeKind
    ? [
        ...OPTITECH_EXAM_KINDS.filter(({ key }) => key !== activeKind).map(({ key }) => pickExamForTab(groups[key], exam.exam_date)?.id),
        ...[-1, 1].map((step) => groups[activeKind][groups[activeKind].findIndex((record) => record.id === exam.id) + step]?.id),
      ].filter((id): id is number => Boolean(id))
    : [];
  const targetKey = targetIds.join(",");
  React.useEffect(() => {
    targetIds.forEach((id) =>
      queryClient.prefetchQuery({ queryKey: examPageDataQueryKey(id), queryFn: () => getExamPageData(id), staleTime: 60_000 }),
    );
    // targetIds is derived from targetKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, targetKey]);
  if (!activeKind) return null;

  const records = groups[activeKind];
  const position = records.findIndex((record) => record.id === exam.id);
  const examLink = (target: OpticalExam | undefined) =>
    target?.id ? { to: "/clients/$clientId/exams/$examId" as const, params: { clientId: String(clientId), examId: String(target.id) } } : null;
  const previous = examLink(position > 0 ? records[position - 1] : undefined);
  const next = examLink(position >= 0 && position < records.length - 1 ? records[position + 1] : undefined);
  const [Back, Forward] = i18n.dir() === "rtl" ? [ChevronRight, ChevronLeft] : [ChevronLeft, ChevronRight];

  return (
    <div className="flex items-end gap-3" dir={i18n.dir()}>
      {/* Shown in the layout-tabs row, with the same folder tabs that join the exam card. */}
      <nav aria-label={t("optitech.examTabs.label")} className="flex items-end gap-0.5">
        {OPTITECH_EXAM_KINDS.map(({ key }) => {
          const count = groups[key].length;
          const isActive = key === activeKind;
          const content = (
            <>
              {t(`optitech.examTabs.${key}`)}
              {/* Counts appear once loaded, so a tab never flashes "(0)". */}
              {isSuccess && <span className={cn("tabular-nums", isActive ? "text-primary" : "text-muted-foreground")}>({count})</span>}
            </>
          );
          const className = cn(
            "inline-flex items-center gap-1.5 rounded-t-lg px-[18px] pt-2 pb-[9px] text-[15px] whitespace-nowrap transition-colors",
            isActive
              ? "bg-card text-foreground relative z-[1] font-semibold shadow-sm after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-card after:content-['']"
              : "text-muted-foreground/70 hover:text-foreground font-medium",
          );
          const target = isActive ? null : examLink(pickExamForTab(groups[key], exam.exam_date));
          if (!target) {
            return (
              <span key={key} className={cn(className, !isActive && "hover:text-muted-foreground/70 cursor-default", !isActive && isSuccess && "opacity-50")} aria-current={isActive ? "page" : undefined} aria-disabled={!isActive}>
                {content}
              </span>
            );
          }
          return (
            <GuardedRouterLink key={key} {...target} className={className}>
              {content}
            </GuardedRouterLink>
          );
        })}
      </nav>

      {records.length > 1 && position >= 0 && (
        <div className="text-muted-foreground flex items-center gap-1 pb-2 text-xs">
          {previous ? (
            <GuardedRouterLink {...previous} className="hover:bg-muted rounded-md p-1" aria-label={t("optitech.examTabs.previous")} title={t("optitech.examTabs.previous")}>
              <Back className="size-4" />
            </GuardedRouterLink>
          ) : <span className="p-1 opacity-40"><Back className="size-4" /></span>}
          <span className="tabular-nums" dir="ltr">{position + 1} / {records.length}</span>
          {next ? (
            <GuardedRouterLink {...next} className="hover:bg-muted rounded-md p-1" aria-label={t("optitech.examTabs.next")} title={t("optitech.examTabs.next")}>
              <Forward className="size-4" />
            </GuardedRouterLink>
          ) : <span className="p-1 opacity-40"><Forward className="size-4" /></span>}
        </div>
      )}
    </div>
  );
}
