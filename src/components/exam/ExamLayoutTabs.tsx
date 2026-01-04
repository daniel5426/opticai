import React from "react";
import Tabs, { Tab } from "@uiw/react-tabs-draggable";
import { X as XIcon, RefreshCw, Combine } from "lucide-react";
import { LayoutTab } from "@/pages/exam-detail/types";
import { FULL_DATA_NAME } from "@/pages/exam-detail/utils";

interface ExamLayoutTabsProps {
    layoutTabs: LayoutTab[];
    activeInstanceId: number | null;
    isEditing: boolean;
    isRegeneratingFullData: boolean;
    onTabClick: (id: number) => void;
    onTabDrop: (id: string, index?: number) => void;
    onRegenerateFullData: () => void;
    onRemoveTab: (tabId: number) => void;
}

export function ExamLayoutTabs({
    layoutTabs,
    activeInstanceId,
    isEditing,
    isRegeneratingFullData,
    onTabClick,
    onTabDrop,
    onRegenerateFullData,
    onRemoveTab,
}: ExamLayoutTabsProps) {
    if (layoutTabs.length === 0) return null;

    const activeTab = layoutTabs.find((t) => t.isActive);

    return (
        <div className="">
            <div className="flex items-center gap-2">
                <div
                    dir="ltr"
                    className="ml-auto"
                    style={{ position: "relative" }}
                >
                    <Tabs
                        activeKey={activeInstanceId?.toString() || ""}
                        style={{
                            gap: 6,
                            position: "relative",
                            backgroundColor: "hsl(var(--card))",
                            padding: "8px",
                            borderRadius: "8px",
                            border: "1px solid hsl(var(--border))",
                        }}
                        onTabClick={(id) => onTabClick(Number(id))}
                        onTabDrop={onTabDrop}
                    >
                        {layoutTabs.map((tab) => (
                            <Tab
                                key={tab.id}
                                id={tab.id.toString()}
                                style={{
                                    backgroundColor: tab.isActive
                                        ? "hsl(var(--primary))"
                                        : "hsl(var(--card))",
                                    color: tab.isActive
                                        ? "hsl(var(--primary-foreground))"
                                        : "hsl(var(--foreground))",
                                    padding: "6px 10px",
                                    borderRadius: "8px",
                                    fontSize: "14px",
                                    fontWeight: "500",
                                }}
                            >
                                {tab.name === FULL_DATA_NAME ? (
                                    <Combine />
                                ) : (
                                    tab.name
                                )}
                            </Tab>
                        ))}
                    </Tabs>
                </div>
                {layoutTabs.length > 0 && (
                    <div className="flex ml-2 items-center gap-2">
                        {activeTab && activeTab.name === FULL_DATA_NAME && (
                            <button
                                type="button"
                                onClick={onRegenerateFullData}
                                className="hover:bg-muted bg-card border border-border flex h-[27px] w-[27px] items-center justify-center rounded-lg"
                                aria-label="רענן נתונים"
                                title="רענן"
                                disabled={isRegeneratingFullData}
                            >
                                <RefreshCw
                                    className={`h-3.5 w-3.5 ${isRegeneratingFullData ? "animate-spin" : ""}`}
                                />
                            </button>
                        )}
                        {layoutTabs.length > 1 && isEditing && activeTab && (
                            <button
                                type="button"
                                onClick={() => onRemoveTab(activeTab.id)}
                                className="flex h-[24px] w-[24px] items-center justify-center rounded-md bg-red-500 text-white hover:bg-red-600"
                                aria-label="הסר לשונית"
                            >
                                <XIcon className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
