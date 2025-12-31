import React, { useState, useEffect, useMemo, useRef } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import { getExamPageData } from "@/lib/db/exams-db";
import {
    ExamCardRenderer,
    calculateCardWidth,
    hasNoteCard,
    CardItem
} from "@/components/exam/ExamCardRenderer";
import Tabs, { Tab } from "@uiw/react-tabs-draggable";
import { Combine, Loader2 } from "lucide-react";
import { useRowWidthTracking } from "@/hooks/shared/useRowWidthTracking";
import { Skeleton } from "@/components/ui/skeleton";

interface ExamPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    examId: number | null;
}

interface LayoutTab {
    id: number;
    layout_id: number;
    name: string;
    layout_data: string;
    isActive: boolean;
}

interface CardRow {
    id: string;
    cards: CardItem[];
}

const FULL_DATA_NAME = "כל הנתונים";

export function ExamPreviewModal({ isOpen, onClose, examId }: ExamPreviewModalProps) {
    const [loading, setLoading] = useState(false);
    const [examData, setExamData] = useState<any>(null);
    const [activeInstanceId, setActiveInstanceId] = useState<number | null>(null);
    const [layoutTabs, setLayoutTabs] = useState<LayoutTab[]>([]);
    const [cardRows, setCardRows] = useState<CardRow[]>([]);
    const [examFormData, setExamFormData] = useState<Record<string, any>>({});
    const [examFormDataByInstance, setExamFormDataByInstance] = useState<Record<number, Record<string, any>>>({});

    const { rowWidths, rowRefs } = useRowWidthTracking(cardRows, [activeInstanceId, layoutTabs]);

    useEffect(() => {
        if (isOpen && examId) {
            loadData(examId);
        } else {
            // Reset state when closed
            setExamData(null);
            setLayoutTabs([]);
            setCardRows([]);
            setExamFormData({});
            setExamFormDataByInstance({});
            setActiveInstanceId(null);
        }
    }, [isOpen, examId]);

    const loadData = async (id: number) => {
        setLoading(true);
        try {
            const pageData = await getExamPageData(id);
            if (pageData) {
                setExamData(pageData.exam);

                const instances = pageData.instances || [];
                const tabs: LayoutTab[] = instances.map((inst: any) => ({
                    id: inst.instance.id,
                    layout_id: inst.instance.layout_id,
                    name: inst.layout?.name || "ללא שם",
                    layout_data: inst.instance.layout_data || inst.layout?.layout_data || "",
                    isActive: inst.instance.id === pageData.chosen_active_instance_id
                }));

                setLayoutTabs(tabs);

                const dataByInstance: Record<number, any> = {};
                instances.forEach((inst: any) => {
                    dataByInstance[inst.instance.id] = inst.exam_data || {};
                });
                setExamFormDataByInstance(dataByInstance);

                const activeTab = tabs.find(t => t.isActive) || tabs[0];
                if (activeTab) {
                    setActiveInstanceId(activeTab.id);
                    applyLayoutStructure(activeTab.layout_data);
                    setExamFormData(dataByInstance[activeTab.id] || {});
                }
            }
        } catch (error) {
            console.error("Error loading preview data:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyLayoutStructure = (layoutData?: string) => {
        if (!layoutData) {
            setCardRows([]);
            return;
        }
        try {
            const parsed = JSON.parse(layoutData);
            const rows = Array.isArray(parsed) ? parsed : (parsed.rows || []);
            setCardRows(rows);
        } catch (error) {
            console.error("Error parsing layout structure:", error);
            setCardRows([]);
        }
    };

    const handleLayoutTabChange = (id: number) => {
        const tab = layoutTabs.find(t => t.id === id);
        if (!tab) return;

        setLayoutTabs(prev => prev.map(t => ({ ...t, isActive: t.id === id })));
        setActiveInstanceId(id);
        applyLayoutStructure(tab.layout_data);
        setExamFormData(examFormDataByInstance[id] || {});
    };

    const headerTabs = useMemo(() => (
        layoutTabs.length > 0 ? (
            <div dir="ltr" className="mr-auto" style={{ position: "relative" }}>
                <Tabs
                    activeKey={activeInstanceId?.toString() || ""}
                    style={{
                        gap: 6,
                        position: "relative",
                        backgroundColor: "hsl(var(--card))",
                        padding: "4px",
                        borderRadius: "8px",
                    }}
                    onTabClick={(id) => handleLayoutTabChange(Number(id))}
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
                                padding: "4px 12px",
                                borderRadius: "6px",
                                fontSize: "13px",
                                fontWeight: "500",
                                cursor: "pointer",
                            }}
                        >
                            {tab.name === FULL_DATA_NAME ? <Combine size={16} /> : tab.name}
                        </Tab>
                    ))}
                </Tabs>
            </div>
        ) : null
    ), [layoutTabs, activeInstanceId]);

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title={examData?.test_name || 'תצוגה מהירה'}
            subtitle={examData ? `${new Date(examData.exam_date).toLocaleDateString('he-IL')}${examData.dominant_eye ? ` · עין דומיננטית: ${examData.dominant_eye === 'R' ? 'ימין' : 'שמאל'}` : ''}` : undefined}
            width="!w-[95vw] max-w-[95vw]"
            className="h-[85vh]"
            headerContent={headerTabs}
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">טוען נתונים...</p>
                </div>
            ) : (
                <div className="space-y-6 pb-6" dir="rtl">
                    {/* Cards Container */}
                    <div className="space-y-4 mt-4 overflow-x-hidden">
                        {cardRows.length > 0 ? (
                            cardRows.map((row) => {
                                const pxPerCol = rowWidths[row.id] || 1380;
                                const cardWidths = calculateCardWidth(
                                    row.cards,
                                    row.id,
                                    {}, // No custom widths for preview
                                    pxPerCol,
                                    "detail"
                                );

                                return (
                                    <div key={row.id} className="w-full">
                                        <div
                                            className="flex flex-1 gap-4"
                                            dir="ltr"
                                            ref={(el) => {
                                                rowRefs.current[row.id] = el;
                                            }}
                                        >
                                            {row.cards.map((item, cardIndex) => (
                                                <div
                                                    key={item.id}
                                                    style={{
                                                        width: `${cardWidths[item.id]}%`,
                                                        minWidth: row.cards.length > 1 ? "200px" : "auto",
                                                    }}
                                                >
                                                    <ExamCardRenderer
                                                        item={item}
                                                        rowCards={row.cards}
                                                        isEditing={false}
                                                        mode="detail"
                                                        detailProps={{
                                                            isEditing: false,
                                                            isNewMode: false,
                                                            exam: examData,
                                                            formData: {},
                                                            examFormData: examFormData,
                                                            fieldHandlers: {},
                                                            handleInputChange: () => { },
                                                            handleSelectChange: () => { },
                                                            setFormData: () => { },
                                                            handleNotesChange: () => { },
                                                            allRows: cardRows.map(r => r.cards)
                                                        }}
                                                        hideEyeLabels={cardIndex > 0}
                                                        matchHeight={hasNoteCard(row.cards) && row.cards.length > 1}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 opacity-50">
                                <p>אין נתונים להצגה בפריסה זו</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </CustomModal>
    );
}
