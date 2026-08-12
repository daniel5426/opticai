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
}: ExamLayoutTabsProps) {
  const { direction } = useAppLocale();
  const { t } = useTranslation();
  const visibleTabs = layoutTabs.filter(isPersistableLayoutTab);
  const isFullDataActive = isVirtualFullDataTabId(activeInstanceId);
  const [tabPendingDelete, setTabPendingDelete] =
    React.useState<LayoutTab | null>(null);
  const handleFullDataClick = onFullDataClick ?? onRegenerateFullData;
  const canRemoveLayoutTabs = visibleTabs.length > 0;

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
    border: isActive ? "1px solid hsl(var(--border))" : "1px solid transparent",
    borderBottomColor: isActive ? "hsl(var(--muted))" : "transparent",
    marginBottom: isActive ? "-1px" : 0,
    background: isActive
      ? "linear-gradient(to bottom, hsl(var(--card)), hsl(var(--muted)))"
      : "transparent",
    color: isActive
      ? "hsl(var(--foreground))"
      : "hsl(var(--muted-foreground) / 0.72)",
  });

  return (
    <>
      <div className="border-b">
        <div
          dir={direction}
          className="flex items-end gap-2"
          style={{
            alignItems: "flex-end",
          }}
        >
          <div
            dir="ltr"
            className="shrink-0"
            style={{
              position: "relative",
              display: "flex",
            }}
          >
            {visibleTabs.length > 0 ? (
              <Tabs
                activeKey={
                  !isFullDataActive ? activeInstanceId?.toString() || "" : ""
                }
                style={{
                  gap: 2,
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
                    className="group"
                    style={folderTab(tab.isActive)}
                  >
                    <Combine
                      style={{
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        opacity: tab.isActive ? 1 : 0.5,
                        color: "hsl(var(--primary))",
                      }}
                    />
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
          <div className="ms-auto flex items-end gap-2" dir={direction}>
            <button
              type="button"
              onClick={handleFullDataClick}
              style={folderTab(isFullDataActive)}
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
              <span>{t("allData")}</span>
            </button>
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
