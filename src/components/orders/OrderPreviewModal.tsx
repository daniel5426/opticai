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
import { Skeleton } from "@/components/ui/skeleton";

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
                </div>
            );
        } else {
            const fpData = orderDataObj["final-prescription"] || {};
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
