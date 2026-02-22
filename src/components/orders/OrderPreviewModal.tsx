import React, { useState, useEffect, useMemo } from "react";
import { CustomModal } from "@/components/ui/custom-modal";
import { getOrderById, getContactLensOrderById } from "@/lib/db/orders-db";
import { getAllUsers } from "@/lib/db/users-db";
import { Order, ContactLensOrder, User } from "@/lib/db/schema-interface";
import {
    ExamCardRenderer,
} from "@/components/exam/ExamCardRenderer";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatValue = (value: unknown) => {
    if (value === undefined || value === null || value === "") return "—";
    return String(value);
};

function PreviewField({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="rounded-md border bg-card p-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-sm font-medium">{formatValue(value)}</div>
        </div>
    );
}

interface OrderPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: number | null;
    isContact?: boolean;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
}

export function OrderPreviewModal({
    isOpen,
    onClose,
    orderId,
    isContact = false,
    onNext,
    onPrev,
    hasNext,
    hasPrev
}: OrderPreviewModalProps) {
    const [loading, setLoading] = useState(false);
    const [orderData, setOrderData] = useState<Order | ContactLensOrder | null>(null);
    const [users, setUsers] = useState<User[]>([]);

    useEffect(() => {
        const loadUsers = async () => {
            const allUsers = await getAllUsers();
            setUsers(allUsers);
        };
        loadUsers();
    }, []);

    useEffect(() => {
        if (isOpen && orderId) {
            loadData(orderId, isContact);
        } else {
            setOrderData(null);
        }
    }, [isOpen, orderId, isContact]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === "ArrowLeft" && hasNext) {
                onNext?.();
            } else if (e.key === "ArrowRight" && hasPrev) {
                onPrev?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, hasNext, hasPrev, onNext, onPrev]);

    const loadData = async (id: number, contact: boolean) => {
        setLoading(true);
        try {
            if (contact) {
                const data = await getContactLensOrderById(id);
                // Cast to any then Order if it has the common fields
                setOrderData(data as any);
            } else {
                const data = await getOrderById(id);
                setOrderData(data);
            }
        } catch (error) {
            console.error("Error loading order preview data:", error);
        } finally {
            setLoading(false);
        }
    };

    const examiner = useMemo(() => {
        const data = orderData as any;
        if (!data?.user_id) return "לא נבחר";
        const user = users.find(u => u.id === data.user_id);
        return user?.full_name || user?.username || "לא נמצא";
    }, [orderData, users]);

    const orderDateFormatted = useMemo(() => {
        const data = orderData as any;
        if (!data?.order_date) return "";
        return new Date(data.order_date).toLocaleDateString("he-IL");
    }, [orderData]);

    const headerContent = useMemo(() => (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!hasPrev}
                    onClick={onPrev}
                    title="הקודם"
                    className="h-8 w-8"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    disabled={!hasNext}
                    onClick={onNext}
                    title="הבא"
                    className="h-8 w-8"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>
        </div>
    ), [onNext, onPrev, hasNext, hasPrev]);

    const renderPreviewContent = () => {
        if (!orderData) return null;

        const orderDataObj = (orderData as any).order_data || {};

        if (isContact) {
            const clExamData = orderDataObj["contact-lens-exam"] || {};
            const clDetailsData = orderDataObj["contact-lens-details"] || {};
            return (
                <div className="space-y-4">
                    <ExamCardRenderer
                        item={{ id: "contact-lens-exam", type: "contact-lens-exam" }}
                        rowCards={[{ id: "contact-lens-exam", type: "contact-lens-exam" }]}
                        isEditing={false}
                        mode="detail"
                        detailProps={{
                            isEditing: false,
                            isNewMode: false,
                            exam: null,
                            formData: {},
                            examFormData: { "contact-lens-exam": clExamData },
                            fieldHandlers: {},
                            handleInputChange: () => { },
                            handleSelectChange: () => { },
                            setFormData: () => { },
                            handleNotesChange: () => { },
                            allRows: [[{ id: "contact-lens-exam", type: "contact-lens-exam" }]]
                        }}
                        hideEyeLabels={false}
                    />
                    <div className="rounded-md border bg-accent/20 p-4">
                        <h3 className="mb-3 text-sm font-semibold">פרטי עדשות מגע</h3>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">עין ימין</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <PreviewField label="סוג" value={clDetailsData.r_type} />
                                    <PreviewField label="דגם" value={clDetailsData.r_model} />
                                    <PreviewField label="ספק" value={clDetailsData.r_supplier} />
                                    <PreviewField label="חומר" value={clDetailsData.r_material} />
                                    <PreviewField label="צבע" value={clDetailsData.r_color} />
                                    <PreviewField label="כמות" value={clDetailsData.r_quantity} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="text-xs text-muted-foreground">עין שמאל</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <PreviewField label="סוג" value={clDetailsData.l_type} />
                                    <PreviewField label="דגם" value={clDetailsData.l_model} />
                                    <PreviewField label="ספק" value={clDetailsData.l_supplier} />
                                    <PreviewField label="חומר" value={clDetailsData.l_material} />
                                    <PreviewField label="צבע" value={clDetailsData.l_color} />
                                    <PreviewField label="כמות" value={clDetailsData.l_quantity} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        } else {
            const fpData = orderDataObj["final-prescription"] || {};
            const lensFrameTabs = Array.isArray(orderDataObj.lens_frame_tabs)
                ? orderDataObj.lens_frame_tabs
                : [];
            const activeTabId = orderDataObj.active_lens_frame_tab_id;
            const activeTab =
                lensFrameTabs.find((tab: any) => tab?.id === activeTabId) ||
                lensFrameTabs[0] ||
                {
                    type: "",
                    lens: orderDataObj.lens || {},
                    frame: orderDataObj.frame || {},
                };
            const lens = activeTab?.lens || {};
            const frame = activeTab?.frame || {};
            return (
                <div className="space-y-4">
                    <ExamCardRenderer
                        item={{ id: "final-prescription", type: "final-prescription" }}
                        rowCards={[{ id: "final-prescription", type: "final-prescription" }]}
                        isEditing={false}
                        mode="detail"
                        detailProps={{
                            isEditing: false,
                            isNewMode: false,
                            exam: null,
                            formData: {},
                            examFormData: { "final-prescription": fpData },
                            fieldHandlers: {},
                            handleInputChange: () => { },
                            handleSelectChange: () => { },
                            setFormData: () => { },
                            handleNotesChange: () => { },
                            allRows: [[{ id: "final-prescription", type: "final-prescription" }]]
                        }}
                        hideEyeLabels={false}
                    />
                    <div className="rounded-md border bg-accent/20 p-4">
                        <h3 className="mb-3 text-sm font-semibold">פרטי עדשה</h3>
                        <div className="mb-2 text-xs text-muted-foreground">
                            סוג עדשות: <span className="font-medium text-foreground">{formatValue(activeTab?.type)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            <PreviewField label="דגם ימין" value={lens.right_model} />
                            <PreviewField label="דגם שמאל" value={lens.left_model} />
                            <PreviewField label="ספק" value={lens.supplier} />
                            <PreviewField label="חומר" value={lens.material} />
                            <PreviewField label="צבע" value={lens.color} />
                            <PreviewField label="ציפוי" value={lens.coating} />
                        </div>
                    </div>
                    <div className="rounded-md border bg-accent/20 p-4">
                        <h3 className="mb-3 text-sm font-semibold">פרטי מסגרת</h3>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                            <PreviewField label="דגם" value={frame.model} />
                            <PreviewField label="יצרן" value={frame.manufacturer} />
                            <PreviewField label="ספק" value={frame.supplier || frame.supplied_by} />
                            <PreviewField label="צבע" value={frame.color} />
                            <PreviewField label="גשר" value={frame.bridge} />
                            <PreviewField label="רוחב" value={frame.width} />
                            <PreviewField label="גובה" value={frame.height} />
                            <PreviewField label="אורך זרוע" value={frame.length} />
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title={isContact ? "תצוגת הזמנת עדשות מגע" : "תצוגת הזמנה רגילה"}
            subtitle={orderData ? `${orderDateFormatted}${(orderData as any).dominant_eye ? ` · עין דומיננטית: ${(orderData as any).dominant_eye === 'R' ? 'ימין' : 'שמאל'}` : ''} · בודק: ${examiner}` : undefined}
            width="!w-[80vw] max-w-[1000px]"
            className="h-[auto] max-h-[85vh]"
            headerContent={headerContent}
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">טוען נתונים...</p>
                </div>
            ) : (
                <div className="space-y-6 pb-6" dir="rtl">
                    <div className="mt-4">
                        {renderPreviewContent()}
                    </div>
                </div>
            )}
        </CustomModal>
    );
}
