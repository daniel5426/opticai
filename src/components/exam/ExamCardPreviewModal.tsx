import React, { useState, useEffect } from "react";
import { getExamPageData } from "@/lib/db/exams-db";
import { FinalPrescriptionTab } from "@/components/exam/FinalPrescriptionTab";
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab";
import { Loader2 } from "lucide-react";

type CardType = "final-prescription" | "contact-lens-exam";

interface ExamCardPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    examId: number | null;
    cardType: CardType;
}

export function ExamCardPreviewModal({
    isOpen,
    onClose,
    examId,
    cardType,
}: ExamCardPreviewModalProps) {
    const [loading, setLoading] = useState(false);
    const [cardData, setCardData] = useState<any>(null);

    useEffect(() => {
        if (isOpen && examId) {
            loadData(examId);
        } else {
            setCardData(null);
        }
    }, [isOpen, examId, cardType]);

    const loadData = async (id: number) => {
        setLoading(true);
        try {
            const pageData = await getExamPageData(id);
            if (pageData) {
                // Combine exam_data from all instances to find the card
                const combined: Record<string, any> = {};
                const instances = pageData.instances || [];
                instances.forEach((inst: any) => {
                    if (inst.exam_data) {
                        Object.assign(combined, inst.exam_data);
                    }
                });
                setCardData(combined[cardType] || null);
            }
        } catch (error) {
            console.error("Error loading card preview data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
            onClick={onClose}
        >
            <div
                className="w-auto max-w-[90vw]"
                onClick={(e) => e.stopPropagation()}
            >
                {loading ? (
                    <div className="bg-card rounded-lg p-12 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : cardData ? (
                    renderCard(cardType, cardData)
                ) : (
                    <div className="bg-card rounded-lg p-8 text-center text-muted-foreground text-sm">
                        אין נתונים להצגה
                    </div>
                )}
            </div>
        </div>
    );
}

function renderCard(cardType: CardType, data: any) {
    switch (cardType) {
        case "final-prescription":
            return (
                <FinalPrescriptionTab
                    finalPrescriptionData={data}
                    onFinalPrescriptionChange={() => { }}
                    isEditing={false}
                />
            );
        case "contact-lens-exam":
            return (
                <ContactLensExamTab
                    contactLensExamData={data}
                    onContactLensExamChange={() => { }}
                    isEditing={false}
                />
            );
        default:
            return null;
    }
}
