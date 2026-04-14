import React, { useState, ChangeEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PencilIcon, Plus, SaveIcon, TrashIcon } from "lucide-react";
import { useParams } from "@tanstack/react-router";
import {
  createMedicalLog as createMedicalLogApi,
  updateMedicalLog as updateMedicalLogApi,
  deleteMedicalLog as deleteMedicalLogApi,
} from "@/lib/db/medical-logs-db";
import { MedicalLog } from "@/lib/db/schema-interface";
import { useClientData } from "@/contexts/ClientDataContext";
import { useUser } from "@/contexts/UserContext";
import { DateInput } from "@/components/ui/date";

type MedicalRecord = MedicalLog & {
  isEditing?: boolean;
  isDatePickerOpen?: boolean;
  tempDateValue?: string;
};

export const ClientMedicalRecordTab = () => {
  const { clientId } = useParams({ from: "/clients/$clientId" });
  const {
    medicalLogs,
    loading,
    addMedicalLog,
    updateMedicalLog: updateMedicalLogInContext,
    removeMedicalLog,
  } = useClientData();
  const { currentClinic } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [tempIdCounter, setTempIdCounter] = useState(-1);
  const datePickerRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

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
        isDatePickerOpen: false,
      }));
      return [...tempRecords, ...normalizedSaved];
    });
  }, [medicalLogs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      records.forEach((record) => {
        if (record.isDatePickerOpen && record.id !== undefined) {
          const pickerElement = datePickerRefs.current[record.id];
          if (pickerElement && !pickerElement.contains(event.target as Node)) {
            if (record.tempDateValue) {
              const newDate = new Date(record.tempDateValue);
              if (!isNaN(newDate.getTime())) {
                setRecords((prevRecords) => {
                  const updated = prevRecords.map((r) =>
                    r.id === record.id
                      ? {
                          ...r,
                          log_date: record.tempDateValue,
                          isDatePickerOpen: false,
                          tempDateValue: undefined,
                        }
                      : r,
                  );
                  const temps = updated.filter((r) => (r.id || 0) < 0);
                  const saved = updated
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
                toast.success("תאריך הרשומה עודכן בהצלחה");
                return;
              }
            }

            setRecords((prevRecords) =>
              prevRecords.map((r) =>
                r.id === record.id
                  ? { ...r, isDatePickerOpen: false, tempDateValue: undefined }
                  : r,
              ),
            );
          }
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [records]);

  const addNewRecord = () => {
    const newTempId = tempIdCounter - 1;
    setTempIdCounter(newTempId);

    const newRecord: MedicalRecord = {
      id: newTempId,
      client_id: Number(clientId),
      log_date: new Date().toISOString().split("T")[0],
      log: "",
      isEditing: true,
      isDatePickerOpen: false,
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
          addMedicalLog(newLog);
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
          updateMedicalLogInContext(updatedLog);
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
          removeMedicalLog(id);
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

  const toggleDatePicker = (id: number) => {
    const record = records.find((r) => r.id === id);
    if (record) {
      setRecords(
        records.map((r) =>
          r.id === id
            ? {
                ...r,
                isDatePickerOpen: !r.isDatePickerOpen,
                tempDateValue: !r.isDatePickerOpen
                  ? r.log_date
                  : r.tempDateValue,
              }
            : r,
        ),
      );
    }
  };

  const handleDateInputChange = (
    id: number,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const inputValue = e.target.value;
    setRecords(
      records.map((record) =>
        record.id === id ? { ...record, tempDateValue: inputValue } : record,
      ),
    );

    if (inputValue.length === 10) {
      const newDate = new Date(inputValue);
      if (!isNaN(newDate.getTime())) {
        setRecords((prevRecords) =>
          prevRecords.map((record) =>
            record.id === id ? { ...record, log_date: inputValue } : record,
          ),
        );
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  };

  if (loading.medicalLogs) {
    return <div className="flex h-32 items-center justify-center"></div>;
  }

  return (
    <div className="flex w-full flex-col">
      <div className="mb-6 flex items-center justify-between">
        <Button onClick={addNewRecord} dir="rtl">
          רשומה חדשה
          <Plus className="mr-2 h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">גליון רפואי</h2>
      </div>

      {records.length === 0 ? (
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

                <div className="relative h-6">
                  <div className="bg-primary absolute right-3 z-10 -mr-3 flex h-6 w-6 items-center justify-center rounded-full">
                    <div className="bg-background h-2 w-2 rounded-full" />
                  </div>

                  <div className="absolute top-1/2 right-10 flex -translate-y-1/2 items-center">
                    <div className="relative mr-3">
                      <span
                        className="text-muted-foreground hover:text-primary cursor-pointer text-sm"
                        onClick={() =>
                          record.id !== undefined && toggleDatePicker(record.id)
                        }
                      >
                        {record.log_date
                          ? formatDate(record.log_date)
                          : "תאריך לא זמין"}
                      </span>

                      {record.isDatePickerOpen && record.id !== undefined && (
                        <div
                          className="bg-background absolute top-6 right-0 z-50 rounded-md border p-1 shadow-md"
                          ref={(el) => {
                            datePickerRefs.current[record.id!] = el;
                          }}
                        >
                          <DateInput
                            name={`medical-log-date-${record.id}`}
                            value={
                              record.tempDateValue || record.log_date || ""
                            }
                            onChange={(e) =>
                              record.id !== undefined &&
                              handleDateInputChange(record.id, e)
                            }
                            className="text-sm"
                          />
                        </div>
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
