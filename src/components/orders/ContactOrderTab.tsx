import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupSelect } from "@/components/ui/lookup-select";
import { UserSelect } from "@/components/ui/user-select";
import { DateInput } from "@/components/ui/date";
import { NotesCard } from "@/components/ui/notes-card";
import { ContactLensDetailsTab } from "@/components/exam/ContactLensDetailsTab";
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab";
import { ContactLensOrderTab } from "@/components/exam/ContactLensOrderTab";
import { ExamToolbox } from "@/components/exam/ExamToolbox";
import { User } from "@/lib/db/schema-interface";
import { ExamComponentType, ExamFieldMapper } from "@/lib/exam-field-mappings";
import {
  copyToClipboard,
  getClipboardContentType,
  pasteFromClipboard,
} from "@/lib/exam-clipboard";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { toast } from "sonner";

interface ContactOrderTabProps {
  formRef: React.RefObject<HTMLFormElement | null>;
  isEditing: boolean;
  users: User[];
  contactFormData: any;
  setContactFormData: React.Dispatch<React.SetStateAction<any>>;
  contactLensDetailsData: any;
  setContactLensDetailsData: React.Dispatch<React.SetStateAction<any>>;
  contactLensExamData: any;
  setContactLensExamData: React.Dispatch<React.SetStateAction<any>>;
  clientOrderIndex?: number | null;
}

export default function ContactOrderTab({
  formRef,
  isEditing,
  users,
  contactFormData,
  setContactFormData,
  contactLensDetailsData,
  setContactLensDetailsData,
  contactLensExamData,
  setContactLensExamData,
  clientOrderIndex,
}: ContactOrderTabProps) {
  const [clipboardSourceType, setClipboardSourceType] =
    useState<ExamComponentType | null>(null);

  useEffect(() => {
    setClipboardSourceType(getClipboardContentType());
  }, []);

  const contactLensExamCard = {
    id: "contact-lens-exam-order",
    type: "contact-lens-exam" as ExamComponentType,
  };
  const contactLensDetailsCard = {
    id: "contact-lens-details-order",
    type: "contact-lens-details" as ExamComponentType,
  };

  const applyToContactLensExam = (nextData: Record<string, unknown>) => {
    setContactLensExamData((prev: any) => {
      const updated = { ...prev };
      Object.entries(nextData).forEach(([key, value]) => {
        if (
          key !== "id" &&
          key !== "layout_instance_id" &&
          value !== undefined
        ) {
          updated[key] = value;
        }
      });
      return updated;
    });
  };

  const applyToContactLensDetails = (nextData: Record<string, unknown>) => {
    setContactLensDetailsData((prev: any) => {
      const updated = { ...prev };
      Object.entries(nextData).forEach(([key, value]) => {
        if (
          key !== "id" &&
          key !== "layout_instance_id" &&
          value !== undefined
        ) {
          updated[key] = value;
        }
      });
      return updated;
    });
  };

  const handleToolboxClear = (targetType: ExamComponentType) => {
    inputSyncManager.flush();
    if (targetType === "contact-lens-exam") {
      applyToContactLensExam(
        ExamFieldMapper.clearData(contactLensExamData, targetType) as Record<
          string,
          unknown
        >,
      );
      return;
    }
    applyToContactLensDetails(
      ExamFieldMapper.clearData(contactLensDetailsData, targetType) as Record<
        string,
        unknown
      >,
    );
  };

  const handleToolboxCopy = (sourceType: ExamComponentType) => {
    inputSyncManager.flush();
    const sourceData =
      sourceType === "contact-lens-exam"
        ? contactLensExamData
        : contactLensDetailsData;
    copyToClipboard(sourceType, sourceData);
    setClipboardSourceType(sourceType);
    toast.success("נתונים הועתקו");
  };

  const handleToolboxPaste = (targetType: ExamComponentType) => {
    inputSyncManager.flush();
    const clipboardContent = pasteFromClipboard();
    if (!clipboardContent) {
      toast.error("אין נתונים בלוח ההעתקה");
      return;
    }

    const { type: sourceType, data: sourceData } = clipboardContent;
    const isCompatible =
      sourceType === targetType ||
      ExamFieldMapper.getAvailableTargets(sourceType, [targetType]).includes(
        targetType,
      );

    if (!isCompatible) {
      toast.error("נתונים לא תואמים");
      return;
    }

    const targetData =
      targetType === "contact-lens-exam"
        ? contactLensExamData
        : contactLensDetailsData;

    const copiedData = ExamFieldMapper.copyData(
      sourceData as Record<string, unknown>,
      targetData as Record<string, unknown>,
      sourceType,
      targetType,
    );

    if (targetType === "contact-lens-exam") {
      applyToContactLensExam(copiedData);
    } else {
      applyToContactLensDetails(copiedData);
    }

    setClipboardSourceType(sourceType);
    toast.success("נתונים הודבקו בהצלחה");
  };

  return (
    <form
      ref={formRef}
      className="no-scrollbar pt-4 pb-10"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Two-column layout for the top section */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4" dir="rtl">
          <div className="lg:col-span-1">
            <Card
              className="examcard h-full w-full gap-0 pt-[8px] pb-1"
              dir="ltr"
            >
              <CardHeader className="px-4 pb-2">
                <CardTitle className="text-muted-foreground text-center font-medium">
                  פרטי הזמנה {clientOrderIndex ? `(#${clientOrderIndex})` : ""}
                </CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-3 px-4 pt-0" dir="rtl">
                <div>
                  <label className="text-muted-foreground text-xs font-medium">
                    תאריך הזמנה
                  </label>
                  <div className="h-1"></div>
                  <DateInput
                    name="order_date"
                    className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                    value={contactFormData.order_date}
                    onChange={(e) =>
                      setContactFormData((prev: any) => ({
                        ...prev,
                        order_date: e.target.value,
                      }))
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs font-medium">
                    סוג הזמנה
                  </label>
                  <div className="h-1"></div>
                  {isEditing ? (
                    <LookupSelect
                      value={contactFormData.type || ""}
                      onChange={(value) =>
                        setContactFormData((prev: any) => ({
                          ...prev,
                          type: value,
                        }))
                      }
                      lookupType="orderType"
                      placeholder="סוג הזמנה..."
                      className="h-8 bg-white text-xs"
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-8 items-center rounded-md border px-3 text-xs">
                      {contactFormData.type || "לא נבחר"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-muted-foreground text-xs font-medium">
                    בודק
                  </label>
                  <div className="h-1"></div>
                  {isEditing ? (
                    <UserSelect
                      value={contactFormData.user_id}
                      onValueChange={(userId) =>
                        setContactFormData((prev: any) => ({
                          ...prev,
                          user_id: userId,
                        }))
                      }
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-8 items-center rounded-md border px-3 text-xs">
                      {contactFormData.user_id
                        ? users.find((u) => u.id === contactFormData.user_id)
                            ?.full_name ||
                          users.find((u) => u.id === contactFormData.user_id)
                            ?.username ||
                          "משתמש לא נמצא"
                        : "לא נבחר בודק"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-muted-foreground text-xs font-medium">
                    עין דומיננטית
                  </label>
                  <div className="h-1"></div>
                  <Select
                    dir="rtl"
                    disabled={!isEditing}
                    value={contactFormData.dominant_eye || ""}
                    onValueChange={(value) =>
                      setContactFormData((prev: any) => ({
                        ...prev,
                        dominant_eye: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                    >
                      <SelectValue placeholder="בחר עין" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R" className="text-xs">
                        ימין
                      </SelectItem>
                      <SelectItem value="L" className="text-xs">
                        שמאל
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-3">
            <div className="relative">
              <ExamToolbox
                isEditing={isEditing}
                mode="detail"
                currentCard={contactLensExamCard as any}
                allRows={[[contactLensExamCard as any]]}
                currentRowIndex={0}
                currentCardIndex={0}
                clipboardSourceType={clipboardSourceType}
                onClearData={() => handleToolboxClear("contact-lens-exam")}
                onCopy={() => handleToolboxCopy("contact-lens-exam")}
                onPaste={() => handleToolboxPaste("contact-lens-exam")}
                onCopyLeft={() => {}}
                onCopyRight={() => {}}
                onCopyBelow={() => {}}
              />
              <ContactLensExamTab
                contactLensExamData={contactLensExamData}
                onContactLensExamChange={(field, value) =>
                  setContactLensExamData((prev: any) => ({
                    ...prev,
                    [field]: value,
                  }))
                }
                isEditing={isEditing}
              />
            </div>

            <div className="relative">
              <ExamToolbox
                isEditing={isEditing}
                mode="detail"
                currentCard={contactLensDetailsCard as any}
                allRows={[[contactLensDetailsCard as any]]}
                currentRowIndex={0}
                currentCardIndex={0}
                clipboardSourceType={clipboardSourceType}
                onClearData={() => handleToolboxClear("contact-lens-details")}
                onCopy={() => handleToolboxCopy("contact-lens-details")}
                onPaste={() => handleToolboxPaste("contact-lens-details")}
                onCopyLeft={() => {}}
                onCopyRight={() => {}}
                onCopyBelow={() => {}}
              />
              <ContactLensDetailsTab
                contactLensDetailsData={contactLensDetailsData}
                onContactLensDetailsChange={(field, value) =>
                  setContactLensDetailsData((prev: any) => ({
                    ...prev,
                    [field]: value,
                  }))
                }
                isEditing={isEditing}
              />
            </div>
          </div>
        </div>

        <div className="w-full" dir="rtl">
          <ContactLensOrderTab
            contactLensOrder={contactFormData}
            onContactLensOrderChange={(field: any, value: any) =>
              setContactFormData((prev: any) => ({ ...prev, [field]: value }))
            }
            isEditing={isEditing}
            users={users}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <NotesCard
            title="הערות"
            value={contactFormData.notes || ""}
            onChange={(value) =>
              setContactFormData((prev: any) => ({ ...prev, notes: value }))
            }
            disabled={!isEditing}
            placeholder="הערות..."
          />
          <NotesCard
            title="הערות לספק"
            value={contactFormData.supplier_notes || ""}
            onChange={(value) =>
              setContactFormData((prev: any) => ({
                ...prev,
                supplier_notes: value,
              }))
            }
            disabled={!isEditing}
            placeholder="הערות לספק..."
          />
        </div>
      </div>
    </form>
  );
}
