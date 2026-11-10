import { useKeyboardSave } from "@/hooks/shared/useKeyboardSave";
import { SaveStatus } from "@/components/SaveStatus";
import { useSaveController } from "@/hooks/shared/useSaveController";
import { ListPageHeader } from "@/components/list-page-header"
import { ImportedSourceDataDialog } from "@/components/migration/ImportedSourceDataDialog";
import React, { useState, ChangeEvent, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PencilIcon, Plus, SaveIcon, TrashIcon } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  createMedicalLog as createMedicalLogApi,
  updateMedicalLog as updateMedicalLogApi,
  deleteMedicalLog as deleteMedicalLogApi,
} from "@/lib/db/medical-logs-db";
import { MedicalLog } from "@/lib/db/schema-interface";
import { useUser } from "@/contexts/UserContext";
import { DateInput } from "@/components/ui/date";
import {
  clientQueryKeys,
  removeQueryItemById,
  replaceQueryItemById,
  upsertQueryItemById,
  useClientMedicalLogsQuery,
} from "@/hooks/client/useClientTabQueries";
import { useAppLocale } from "@/localization/use-app-locale";
import { CustomModal } from "@/components/ui/custom-modal";
import { useTranslation } from "react-i18next";

const EMPTY_MEDICAL_LOGS: MedicalLog[] = [];

type MedicalRecord = MedicalLog & {
  isEditing?: boolean;
  uiKey?: number;
};

interface ClientMedicalRecordTabProps {
  enabled?: boolean;
}

const MedicalRecordsSkeleton = ({ direction }: { direction: "rtl" | "ltr" }) => (
  <div className="relative ms-6" dir={direction}>
    <div className="space-y-8">
      {[0, 1, 2].map((item) => (
        <div key={item} className="relative">
          {item < 2 && (
            <div className="bg-primary/10 absolute top-6 start-3 h-[calc(100%+2rem-6px)] w-0.5" />
          )}
          <div className="relative h-6">
            <Skeleton className="absolute top-1/2 start-0 h-6 w-6 -translate-y-1/2 rounded-full" />
            <Skeleton className="absolute top-1/2 start-10 h-4 w-36 -translate-y-1/2" />
          </div>
          <div className="mt-4 ms-14 space-y-2">
            <Skeleton className="h-4 w-full max-w-3xl" />
            <Skeleton className="h-4 w-4/5 max-w-2xl" />
            <Skeleton className="h-4 w-3/5 max-w-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ClientMedicalRecordTab = ({
  enabled = true,
}: ClientMedicalRecordTabProps) => {
  const { t } = useTranslation();
  const { direction, locale } = useAppLocale();
  const { clientId } = useParams({ from: "/clients/$clientId" });
  const clientIdNum = Number(clientId);
  const queryClient = useQueryClient();
  const medicalLogsQuery = useClientMedicalLogsQuery(clientIdNum, enabled);
  const medicalLogs = medicalLogsQuery.data ?? EMPTY_MEDICAL_LOGS;
  const queryKey = clientQueryKeys.medicalLogs(clientIdNum);
  const { currentClinic } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [tempIdCounter, setTempIdCounter] = useState(-1);
  const [recordToDelete, setRecordToDelete] = useState<MedicalRecord | null>(null);

  const recordsClientRef = useRef(clientIdNum);
  const savingRecords = useRef(new Set<number>());
  const [savingRecordIds, setSavingRecordIds] = useState<number[]>([]);
  const saveController = useSaveController({identity:clientIdNum});
  const [statusRecordId, setStatusRecordId] = useState<number | null>(null);

  useEffect(() => {
    const sameClient = recordsClientRef.current === clientIdNum;
    recordsClientRef.current = clientIdNum;
    const sortedLogs = [...medicalLogs].sort((a, b) => {
      const dateA = new Date(a.log_date || "").getTime();
      const dateB = new Date(b.log_date || "").getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return (b.id || 0) - (a.id || 0);
    });
    setRecords((prev) => {
      const drafts = sameClient ? prev.filter(record => record.isEditing) : [];
      const draftById = new Map(drafts.map(record => [record.id, record]));
      const savedIds = new Set(sortedLogs.map(log => log.id));
      const retainedDrafts = drafts.filter(record => !savedIds.has(record.id));
      const normalizedSaved = sortedLogs.map(log => draftById.get(log.id) || { ...log, isEditing: false });
      if (sameClient && prev.length) {
        const incoming = new Map(normalizedSaved.map(record => [record.id, record]));
        const existing = new Set(prev.map(record => record.id));
        return [...prev.filter(record => record.isEditing || incoming.has(record.id)).map(record => record.isEditing ? record : {...incoming.get(record.id)!, uiKey:record.uiKey}),
          ...normalizedSaved.filter(record => !existing.has(record.id))];
      }
      return [...retainedDrafts, ...normalizedSaved];
    });
  }, [medicalLogs, clientIdNum]);

  const addNewRecord = () => {
    const newTempId = tempIdCounter - 1;
    setTempIdCounter(newTempId);

    const newRecord: MedicalRecord = {
      id: newTempId,
      client_id: Number(clientId),
      log_date: new Date().toISOString().split("T")[0],
      log: "",
      isEditing: true,
    };
    setRecords((prev) => {
      const updatedRecords = [newRecord, ...prev];
      return updatedRecords;
    });
  };

  const handleContentChange = (id: number, content: string) => {
    setRecords(
      records.map((record) =>
        record.id === id ? { ...record, log: content } : record,
      ),
    );
  };

  const saveRecord = async (id: number) => {
    const record = records.find((r) => r.id === id);
    if (!record || savingRecords.current.has(id) || saveController.busy.current) return;
    const original = medicalLogs.find(row => row.id === id);
    if (id > 0 && original?.log === record.log && original?.log_date === record.log_date) return;
    setStatusRecordId(id);
    savingRecords.current.add(id);
    setSavingRecordIds([...savingRecords.current]);

    try {
      await saveController.run(async () => {
      if (id < 0) {
        const newLog = await createMedicalLogApi({
          client_id: Number(clientId),
          clinic_id: currentClinic?.id,
          log_date: record.log_date || new Date().toISOString().split("T")[0],
          log: record.log || "",
        });

        if (newLog) {
          setRecords((prev) => {
            const replaced = prev.map((r) =>
              r.id === id ? { ...newLog, uiKey: record.uiKey ?? id, isEditing: true } : r,
            );
            return replaced;
          });
          queryClient.setQueryData<MedicalLog[]>(queryKey, (current) =>
            upsertQueryItemById(current, newLog),
          );
          setStatusRecordId(newLog.id!);
          toast.success("הרשומה נשמרה בהצלחה");
        } else {
          setRecords((prev) =>
            prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
          );
          throw new Error('save_failed');
        }
      } else {
        const updatedLog = await updateMedicalLogApi({
          id: record.id,
          client_id: record.client_id,
          log_date: record.log_date,
          log: record.log,
        });

        if (updatedLog) {
          setRecords((prev) => {
            const updatedList = prev.map((r) =>
              r.id === id ? { ...updatedLog, uiKey: record.uiKey, isEditing: true } : r,
            );
            return updatedList;
          });
          queryClient.setQueryData<MedicalLog[]>(queryKey, (current) =>
            replaceQueryItemById(current, updatedLog),
          );
          toast.success("הרשומה עודכנה בהצלחה");
        } else {
          setRecords((prev) =>
            prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
          );
          throw new Error('save_failed');
        }
      }
      });
    } catch (error) {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
      );
      toast.error("שגיאה בשמירת הרשומה");
    } finally {
      savingRecords.current.delete(id);
      setSavingRecordIds([...savingRecords.current]);
    }
  };

  useKeyboardSave({enabled:enabled && records.some(record=>record.isEditing), isSaving:saveController.isSaving, onSave:()=>{
    const focused = document.activeElement?.closest<HTMLElement>('[data-medical-record-id]');
    const id = focused?.dataset.medicalRecordId;
    if (id) return saveRecord(Number(id));
  }});

  const editRecord = (id: number) => {
    setRecords(
      records.map((record) =>
        record.id === id ? { ...record, isEditing: true } : record,
      ),
    );
  };

  const deleteRecord = async (id: number) => {
    try {
      if (id < 0) {
        setRecords((prev) => prev.filter((record) => record.id !== id));
        toast.success(t("trashDraftRemoved"));
      } else {
        const previous = records;
        setRecords((prev) => prev.filter((record) => record.id !== id));
        const success = await deleteMedicalLogApi(id);
        if (success) {
          queryClient.setQueryData<MedicalLog[]>(queryKey, (current) =>
            removeQueryItemById(current, id),
          );
        } else {
          setRecords(previous);
          toast.error("שגיאה במחיקת הרשומה");
        }
      }
    } catch (error) {
      toast.error("שגיאה במחיקת הרשומה");
    }
  };

  const handleDateInputChange = (
    id: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const inputValue = e.target.value;
    setRecords((prevRecords) =>
      prevRecords.map((record) =>
        record.id === id ? { ...record, log_date: inputValue } : record,
      ),
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(
      locale === "he" ? "he-IL" : locale === "fr" ? "fr-FR" : "en-US",
      {
      year: "numeric",
      month: "long",
      day: "numeric",
      },
    ).format(date);
  };

  return (
    <div className="mx-auto flex w-full max-w-[1024px] flex-col" dir={direction}>
      <ListPageHeader
        title={t("medicalRecord")}
        className="mb-6 items-center"
        actions={<Button onClick={addNewRecord} dir={direction}>
          {t("newMedicalRecord")}
          <Plus className="ms-2 h-4 w-4" />
        </Button>}
      />

      {medicalLogsQuery.isLoading ? (
        <MedicalRecordsSkeleton direction={direction} />
      ) : records.length === 0 ? (
        <div className="text-muted-foreground py-10 text-center" dir={direction}>
          אין רשומות רפואיות להצגה. לחץ על "הוספת רשומה חדשה" כדי להתחיל.
        </div>
      ) : (
        <div className="relative ms-6">
          <div className="space-y-8">
            {records.map((record, index) => (
              <div key={record.id ?? `new-${index}`} className="group/record relative">
                {index < records.length - 1 && (
                  <div className="bg-primary/30 absolute top-6 start-3 h-[calc(100%+2rem-6px)] w-0.5" />
                )}

                <div
                  className={
                    record.isEditing ? "relative h-10" : "relative h-6"
                  }
                >
                  <div className="bg-primary absolute top-1/2 start-3 z-10 -ms-3 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full">
                    <div className="bg-background h-2 w-2 rounded-full" />
                  </div>

                  <div className="absolute top-1/2 start-10 flex -translate-y-1/2 items-center">
                    <div className="ms-3">
                      {record.isEditing && record.id !== undefined ? (
                        <DateInput
                          disabled={savingRecordIds.includes(record.id!)}
                          name={`medical-log-date-${record.id}`}
                          value={record.log_date || ""}
                          onChange={(e) => handleDateInputChange(record.id!, e)}
                          className="w-40 text-sm"
                        />
                      ) : (
                        <span
                          className="text-muted-foreground hover:text-primary cursor-pointer text-sm"
                          onClick={() =>
                            record.id !== undefined && editRecord(record.id)
                          }
                        >
                          {record.log_date
                            ? formatDate(record.log_date)
                            : "תאריך לא זמין"}
                        </span>
                      )}
                    </div>

                    <div className={`ms-1 flex gap-1 ${record.isEditing ? "" : "pointer-events-none opacity-0 group-hover/record:pointer-events-auto group-hover/record:opacity-100 group-focus-within/record:pointer-events-auto group-focus-within/record:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"}`}>
                      {!record.isEditing && <ImportedSourceDataDialog recordType="medical_log" recordId={record.id} />}
                      {statusRecordId === record.id && <SaveStatus state={saveController.state} onRetry={() => void saveRecord(record.id!)}/>}
                      {record.isEditing ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t("saveStatus.save")}
                          disabled={savingRecordIds.includes(record.id!)}
                          onClick={() =>
                            record.id !== undefined && saveRecord(record.id)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <SaveIcon className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t("editMedicalRecord")}
                          onClick={() =>
                            record.id !== undefined && editRecord(record.id)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={savingRecordIds.includes(record.id!)}
                        onClick={() => setRecordToDelete(record)}
                        aria-label={t("trashMoveConfirm")}
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 ms-14 text-foreground">
                    {record.isEditing ? (
                      <Textarea
                        value={record.log || ""}
                        disabled={savingRecordIds.includes(record.id!)}
                        onChange={(e) =>
                          record.id !== undefined &&
                          handleContentChange(record.id, e.target.value)
                        }
                        placeholder="הזן את תוכן הרשומה הרפואית..."
                        className="min-h-[100px] resize-none"
                        dir={direction}
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words" dir={direction}>
                        {record.log || "אין תוכן"}
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <CustomModal
        isOpen={Boolean(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
        title={t("trashMoveTitle")}
        description={t("trashMoveDescription", { item: t("trashTypeMedicalNote") })}
        onConfirm={() => {
          if (recordToDelete?.id !== undefined) void deleteRecord(recordToDelete.id)
          setRecordToDelete(null)
        }}
        confirmText={t("trashMoveConfirm")}
        cancelText={t("cancel")}
        direction={direction}
      />
    </div>
  );
};
