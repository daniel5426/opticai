import React from "react";
import Tabs, { Tab } from "@uiw/react-tabs-draggable";
import { Combine, X } from "lucide-react";
import { LayoutTab } from "@/pages/exam-detail/types";
import {
  isPersistableLayoutTab,
  isVirtualFullDataTabId,
} from "@/pages/exam-detail/utils";
import { CustomModal } from "@/components/ui/custom-modal";
import { useAppLocale } from "@/localization/use-app-locale";
import { useTranslation } from "react-i18next";

interface ExamLayoutTabsProps {
  layoutTabs: LayoutTab[];
  activeInstanceId: number | null;
  onTabClick: (id: number) => void;
  onTabDrop: (id: string, index?: number) => void;
  onFullDataClick?: () => void;
  onRegenerateFullData?: () => void;
  isRegeneratingFullData?: boolean;
  hasTabData?: (tab: LayoutTab) => boolean;
  onRemoveTab: (tabId: number) => void;
  actions?: React.ReactNode;
  addLayoutAction?: React.ReactNode;
}

export function ExamLayoutTabs({
  layoutTabs,
  activeInstanceId,
  onTabClick,
  onTabDrop,
  onFullDataClick,
  onRegenerateFullData,
  isRegeneratingFullData = false,
  hasTabData = () => true,
  onRemoveTab,
  actions,
  addLayoutAction,
}: ExamLayoutTabsProps) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const visibleTabs = layoutTabs.filter(isPersistableLayoutTab);
  const isFullDataActive = isVirtualFullDataTabId(activeInstanceId);
  const [tabPendingDelete, setTabPendingDelete] =
    React.useState<LayoutTab | null>(null);
  const handleFullDataClick = onFullDataClick ?? onRegenerateFullData;
  const canRemoveLayoutTabs = visibleTabs.length > 0;
  const activeTabShadow =
    "shadow-sm after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-2 after:bg-card after:content-['']";

  const requestDelete = (tab: LayoutTab) => {
    if (hasTabData(tab)) {
      setTabPendingDelete(tab);
      return;
    }

    onRemoveTab(tab.id);
  };

  const confirmDelete = () => {
    if (!tabPendingDelete) return;
    onRemoveTab(tabPendingDelete.id);
    setTabPendingDelete(null);
  };

  /* ── connected-tab style helper ── */
  const folderTab = (isActive: boolean): React.CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "8px 18px 9px",
    fontSize: "15px",
    fontWeight: isActive ? 600 : 500,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease",
    borderRadius: "8px 8px 0 0",
    border: "none",
    marginBottom: isActive ? "-1px" : 0,
    zIndex: isActive ? 1 : undefined,
    background: isActive ? "hsl(var(--card))" : "transparent",
    color: isActive
      ? "hsl(var(--foreground))"
      : "hsl(var(--muted-foreground) / 0.72)",
  });

  return (
    <>
      <div data-exam-surface>
        <div
          dir={direction}
          className="flex items-end gap-2 pe-2"
          style={{
            alignItems: "flex-end",
          }}
        >
          <div className="flex min-w-0 flex-1 items-end gap-1">
            <div className="relative top-px -ms-3 -mt-3 -mb-2 min-w-0">
            <div
              dir="ltr"
              className="no-scrollbar overflow-x-auto"
              style={{ scrollbarWidth: "none" }}
            >
            <div dir={direction} className="me-auto flex shrink-0 items-end gap-2 ps-3 pe-3 pt-3 pb-2">
              {visibleTabs.length > 0 ? (
                <Tabs
                  dir="ltr"
                  activeKey={
                    !isFullDataActive ? activeInstanceId?.toString() || "" : ""
                  }
                  style={{
                    gap: 2,
                    flexShrink: 0,
                    alignItems: "flex-end",
                    position: "relative",
                    backgroundColor: "transparent",
                    padding: 0,
                    borderRadius: 0,
                    border: "none",
                  }}
                  onTabClick={(id) => onTabClick(Number(id))}
                  onTabDrop={onTabDrop}
                >
                  {visibleTabs.map((tab) => (
                    <Tab
                      key={tab.id}
                      id={tab.id.toString()}
                      className={`group ${tab.isActive ? activeTabShadow : ""}`}
                      style={{ ...folderTab(tab.isActive), marginBottom: 0 }}
                    >
                      {tab.name}
                      {canRemoveLayoutTabs ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            requestDelete(tab);
                          }}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          className="ms-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={t("deleteLayoutTab")}
                          title={t("deleteLayoutTab")}
                        >
                          <X className="h-3 w-3" strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </Tab>
                  ))}
                </Tabs>
              ) : null}
            </div>
            </div>
            </div>
            {addLayoutAction ? <div className="shrink-0">{addLayoutAction}</div> : null}
          </div>
          <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-end gap-x-2 gap-y-2" dir={direction}>
            <button
              type="button"
              onClick={handleFullDataClick}
              className={isFullDataActive ? activeTabShadow : undefined}
              style={{
                ...folderTab(isFullDataActive),
                height: isFullDataActive ? 43 : 42,
                padding: "0 18px",
                paddingBottom: isFullDataActive ? 7 : 6,
              }}
              aria-label={t("allData")}
              title={t("allData")}
              disabled={!handleFullDataClick || isRegeneratingFullData}
            >
              <Combine
                style={{
                  width: 16,
                  height: 16,
                  flexShrink: 0,
                  opacity: isFullDataActive ? 1 : 0.6,
                  color: "hsl(var(--primary))",
                }}
              />
            </button>
            {actions ? (
              <div className="flex flex-wrap items-center gap-2 pb-1.5">
                {actions}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <CustomModal
        isOpen={Boolean(tabPendingDelete)}
        onClose={() => setTabPendingDelete(null)}
        onConfirm={confirmDelete}
        confirmText={t("delete")}
        cancelText={t("cancel")}
        title={t("deleteLayoutTab")}
        description={t("deleteLayoutTabDescription", {
          name: tabPendingDelete?.name || "",
        })}
        showCloseButton={false}
        direction={direction}
      />
    </>
  );
}
