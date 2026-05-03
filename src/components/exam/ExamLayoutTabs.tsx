import React from "react";
import Tabs, { Tab } from "@uiw/react-tabs-draggable";
import { Combine, Trash2 } from "lucide-react";
import { LayoutTab } from "@/pages/exam-detail/types";
import {
  isPersistableLayoutTab,
  isVirtualFullDataTabId,
} from "@/pages/exam-detail/utils";
import { CustomModal } from "@/components/ui/custom-modal";

interface ExamLayoutTabsProps {
  layoutTabs: LayoutTab[];
  activeInstanceId: number | null;
  isEditing: boolean;
  onTabClick: (id: number) => void;
  onTabDrop: (id: string, index?: number) => void;
  onFullDataClick?: () => void;
  onRegenerateFullData?: () => void;
  isRegeneratingFullData?: boolean;
  onRemoveTab: (tabId: number) => void;
}

export function ExamLayoutTabs({
  layoutTabs,
  activeInstanceId,
  isEditing,
  onTabClick,
  onTabDrop,
  onFullDataClick,
  onRegenerateFullData,
  isRegeneratingFullData = false,
  onRemoveTab,
}: ExamLayoutTabsProps) {
  const visibleTabs = layoutTabs.filter(isPersistableLayoutTab);
  const activeTab = visibleTabs.find((t) => t.isActive);
  const isFullDataActive = isVirtualFullDataTabId(activeInstanceId);
  const [tabPendingDelete, setTabPendingDelete] =
    React.useState<LayoutTab | null>(null);
  const handleFullDataClick = onFullDataClick ?? onRegenerateFullData;
  const showDeleteButton = Boolean(
    visibleTabs.length > 0 && isEditing && activeTab && !isFullDataActive,
  );

  const confirmDelete = () => {
    if (!tabPendingDelete) return;
    onRemoveTab(tabPendingDelete.id);
    setTabPendingDelete(null);
  };

  /* ── pill-tab style helper ── */
  const folderTab = (isActive: boolean): React.CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "7px",
    padding: "7px 18px",
    fontSize: "15px",
    fontWeight: 500,
    whiteSpace: "nowrap",
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease",
    borderRadius: "8px",
    border: isActive ? "1px solid hsl(var(--border))" : "1px solid transparent",
    backgroundColor: isActive ? "hsl(var(--card))" : "transparent",
    color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
  });

  return (
    <>
      <div className="">
        <div
          className="flex items-center gap-2"
          style={{
            alignItems: "center",
          }}
        >
          <div
            dir="ltr"
            className="ml-auto"
            style={{
              position: "relative",
              backgroundColor: "hsl(var(--muted))",
              padding: "4px",
              borderRadius: "10px",
              display: "flex",
            }}
          >
            {visibleTabs.length > 0 ? (
              <Tabs
                activeKey={
                  !isFullDataActive ? activeInstanceId?.toString() || "" : ""
                }
                style={{
                  gap: 4,
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
                  </Tab>
                ))}
              </Tabs>
            ) : null}
          </div>
          <div className="ml-2 flex items-center gap-2" dir="rtl">
            {showDeleteButton ? (
              <button
                type="button"
                onClick={() => {
                  if (activeTab) setTabPendingDelete(activeTab);
                }}
                className="bg-card flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                aria-label="מחק לשונית"
                title="מחק לשונית"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleFullDataClick}
              style={folderTab(isFullDataActive)}
              aria-label="כל הנתונים"
              title="כל הנתונים"
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
              <span>כל הנתונים</span>
            </button>
          </div>
        </div>
      </div>

      <CustomModal
        isOpen={Boolean(tabPendingDelete)}
        onClose={() => setTabPendingDelete(null)}
        onConfirm={confirmDelete}
        confirmText="מחק לשונית"
        cancelText="ביטול"
        title="מחיקת לשונית פריסה"
        description={`פעולה זו תמחק את הלשונית "${tabPendingDelete?.name || ""}" ואת כל הנתונים שנשמרו בה.`}
        showCloseButton={false}
      />
    </>
  );
}
