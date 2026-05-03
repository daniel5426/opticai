import React, { useState, ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type MedicalRecord = MedicalLog & {
  isEditing?: boolean;
};

interface ClientMedicalRecordTabProps {
  enabled?: boolean;
}

const MedicalRecordsSkeleton = () => (
  <div className="relative mr-6" dir="rtl">
    <div className="space-y-8">
      {[0, 1, 2].map((item) => (
        <div key={item} className="relative">
          {item < 2 && (
            <div className="bg-primary/10 absolute top-6 right-3 h-[calc(100%+2rem-6px)] w-0.5" />
          )}
          <div className="relative h-6">
            <Skeleton className="absolute top-1/2 right-0 h-6 w-6 -translate-y-1/2 rounded-full" />
            <Skeleton className="absolute top-1/2 right-10 h-4 w-36 -translate-y-1/2" />
          </div>
          <div className="mt-4 mr-14 space-y-2">
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
  const { clientId } = useParams({ from: "/clients/$clientId" });
  const clientIdNum = Number(clientId);
  const queryClient = useQueryClient();
  const medicalLogsQuery = useClientMedicalLogsQuery(clientIdNum, enabled);
  const medicalLogs = medicalLogsQuery.data || [];
  const queryKey = clientQueryKeys.medicalLogs(clientIdNum);
  const { currentClinic } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [tempIdCounter, setTempIdCounter] = useState(-1);

  useEffect(() => {
    const sortedLogs = [...medicalLogs].sort((a, b) => {
      const dateA = new Date(a.log_date || "").getTime();
      const dateB = new Date(b.log_date || "").getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return (b.id || 0) - (a.id || 0);
    });
    setRecords((prev) => {
      const tempRecords = prev.filter((r) => (r.id || 0) < 0);
      const normalizedSaved = sortedLogs.map((log) => ({
        ...log,
        isEditing: false,
      }));
      return [...tempRecords, ...normalizedSaved];
    });
  }, [medicalLogs]);

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
    if (!record) return;

    try {
      if (id < 0) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isEditing: false } : r)),
        );
        const newLog = await createMedicalLogApi({
          client_id: Number(clientId),
          clinic_id: currentClinic?.id,
          log_date: record.log_date || new Date().toISOString().split("T")[0],
          log: record.log || "",
        });

        if (newLog) {
          setRecords((prev) => {
            const replaced = prev.map((r) =>
              r.id === id ? { ...newLog, isEditing: false } : r,
            );
            const temps = replaced.filter((r) => (r.id || 0) < 0);
            const saved = replaced
              .filter((r) => (r.id || 0) > 0)
              .sort((a, b) => {
                const dateA = new Date(a.log_date || "").getTime();
                const dateB = new Date(b.log_date || "").getTime();
                if (dateB !== dateA) {
                  return dateB - dateA;
                }
                return (b.id || 0) - (a.id || 0);
              });
            return [...temps, ...saved];
          });
          queryClient.setQueryData<MedicalLog[]>(queryKey, (current) =>
            upsertQueryItemById(current, newLog),
          );
          toast.success("הרשומה נשמרה בהצלחה");
        } else {
          setRecords((prev) =>
            prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
          );
          toast.error("שגיאה בשמירת הרשומה");
        }
      } else {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isEditing: false } : r)),
        );
        const updatedLog = await updateMedicalLogApi({
          id: record.id,
          client_id: record.client_id,
          log_date: record.log_date,
          log: record.log,
        });

        if (updatedLog) {
          setRecords((prev) => {
            const updatedList = prev.map((r) =>
              r.id === id ? { ...updatedLog, isEditing: false } : r,
            );
            const temps = updatedList.filter((r) => (r.id || 0) < 0);
            const saved = updatedList
              .filter((r) => (r.id || 0) > 0)
              .sort((a, b) => {
                const dateA = new Date(a.log_date || "").getTime();
                const dateB = new Date(b.log_date || "").getTime();
                if (dateB !== dateA) {
                  return dateB - dateA;
                }
                return (b.id || 0) - (a.id || 0);
              });
            return [...temps, ...saved];
          });
          queryClient.setQueryData<MedicalLog[]>(queryKey, (current) =>
            replaceQueryItemById(current, updatedLog),
          );
          toast.success("הרשומה עודכנה בהצלחה");
        } else {
          setRecords((prev) =>
            prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
          );
          toast.error("שגיאה בעדכון הרשומה");
        }
      }
    } catch (error) {
      setRecords((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isEditing: true } : r)),
      );
      toast.error("שגיאה בשמירת הרשומה");
    }
  };

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
        toast.success("הרשומה נמחקה");
      } else {
        const previous = records;
        setRecords((prev) => prev.filter((record) => record.id !== id));
        const success = await deleteMedicalLogApi(id);
        if (success) {
          queryClient.setQueryData<MedicalLog[]>(queryKey, (current) =>
            removeQueryItemById(current, id),
          );
          toast.success("הרשומה נמחקה בהצלחה");
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
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  return (
    <div className="flex w-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <Button onClick={addNewRecord} dir="rtl">
          רשומה חדשה
          <Plus className="mr-2 h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">גליון רפואי</h2>
      </div>

      {medicalLogsQuery.isLoading ? (
        <MedicalRecordsSkeleton />
      ) : records.length === 0 ? (
        <div className="text-muted-foreground py-10 text-center" dir="rtl">
          אין רשומות רפואיות להצגה. לחץ על "הוספת רשומה חדשה" כדי להתחיל.
        </div>
      ) : (
        <div className="relative mr-6">
          <div className="space-y-8">
            {records.map((record, index) => (
              <div key={record.id ?? `new-${index}`} className="relative">
                {index < records.length - 1 && (
                  <div className="bg-primary/30 absolute top-6 right-3 h-[calc(100%+2rem-6px)] w-0.5" />
                )}

                <div
                  className={
                    record.isEditing ? "relative h-10" : "relative h-6"
                  }
                >
                  <div className="bg-primary absolute top-1/2 right-3 z-10 -mr-3 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full">
                    <div className="bg-background h-2 w-2 rounded-full" />
                  </div>

                  <div className="absolute top-1/2 right-10 flex -translate-y-1/2 items-center">
                    <div className="mr-3">
                      {record.isEditing && record.id !== undefined ? (
                        <DateInput
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

                    <div className="mr-1 flex gap-1">
                      {record.isEditing ? (
                        <Button
                          size="sm"
                          variant="ghost"
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
                          onClick={() =>
                            record.id !== undefined && editRecord(record.id)
                          }
                          className="h-8 w-8 p-0"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          record.id !== undefined && deleteRecord(record.id)
                        }
                        className="text-destructive hover:text-destructive h-8 w-8 p-0"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Card className="mr-14 border-none bg-transparent shadow-none">
                  <CardContent className="border-none">
                    {record.isEditing ? (
                      <Textarea
                        value={record.log || ""}
                        onChange={(e) =>
                          record.id !== undefined &&
                          handleContentChange(record.id, e.target.value)
                        }
                        placeholder="הזן את תוכן הרשומה הרפואית..."
                        className="min-h-[100px] resize-none"
                        dir="rtl"
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap" dir="rtl">
                        {record.log || "אין תוכן"}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
