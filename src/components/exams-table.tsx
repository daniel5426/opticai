import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { OpticalExam, User, Client } from "@/lib/db/schema-interface";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { getAllUsers } from "@/lib/db/users-db";
import { getAllClients } from "@/lib/db/clients-db";
import { CustomModal } from "@/components/ui/custom-modal";
import { deleteExam } from "@/lib/db/exams-db";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ExamWithNames extends OpticalExam {
  username?: string;
  clientName?: string;
  clinic?: string;
  full_name?: string;
}

interface ExamsTableProps {
  data: ExamWithNames[];
  clientId: number;
  onExamDeleted: (examId: number) => void;
  onExamDeleteFailed: () => void;
  loading: boolean;
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void };
}

export function ExamsTable({ data, clientId, onExamDeleted, onExamDeleteFailed, loading, pagination, searchQuery: externalSearch, onSearchChange }: ExamsTableProps & { searchQuery?: string; onSearchChange?: (q: string) => void }) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchValue = externalSearch !== undefined ? externalSearch : searchQuery;
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [examToDelete, setExamToDelete] = useState<ExamWithNames | null>(null);

  // Filter data based on search query
  const filteredData = externalSearch !== undefined ? data : data.filter((exam) => {
    const searchableFields = [
      exam.full_name || exam.username,
      exam.clinic,
      exam.test_name,
      exam.exam_date,
    ];
    return searchableFields.some(
      (field) =>
        field && field.toLowerCase().includes(searchValue.toLowerCase()),
    );
  });

  const handleDeleteConfirm = async () => {
    if (examToDelete && examToDelete.id !== undefined) {
      try {
        const deletedExamId = examToDelete.id;
        // Optimistically update the UI
        onExamDeleted(deletedExamId);
        toast.success("בדיקה נמחקה בהצלחה");

        const success = await deleteExam(deletedExamId);
        if (!success) {
          // Revert optimistic update if API call fails (you might need to refetch or pass original data back)
          toast.error("אירעה שגיאה בעת מחיקת הבדיקה. מרענן נתונים...");
          onExamDeleteFailed(); // Trigger full refresh
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת הבדיקה");
        onExamDeleteFailed(); // Trigger full refresh on error
      } finally {
        setExamToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <div className="space-y-4 mb-10" dir="rtl" style={{scrollbarWidth: 'none'}}>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש בדיקות..."
            value={searchValue}
            onChange={(e) => (onSearchChange ? onSearchChange(e.target.value) : setSearchQuery(e.target.value))}
            className="w-[250px] bg-card dark:bg-card"
            dir="rtl"
          />
        </div>
        {clientId > 0 ? (
          <Link
            to="/clients/$clientId/exams/new"
            params={{ clientId: String(clientId) }}
          >
            <Button>בדיקה חדשה
              <Plus className="h-4 w-4 mr-2" />
              </Button>
          </Link>
        ) : (
          <ClientSelectModal
            triggerText="בדיקה חדשה"
            onClientSelect={(selectedClientId) => {
              navigate({
                to: "/clients/$clientId/exams/new",
                params: { clientId: String(selectedClientId) },
              });
            }}
          />
        )}

      </div>

      <div className="rounded-md bg-card">
        
          <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: 'none' }}>
            <TableHeader className="sticky top-0 z-0 bg-card">
              <TableRow>
                <TableHead className="text-right">תאריך בדיקה</TableHead>
                <TableHead className="text-right">סוג בדיקה</TableHead>
                {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
                <TableHead className="text-right">סניף</TableHead>
                <TableHead className="text-right">בודק</TableHead>
                <TableHead className="w-[50px] text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 14 }).map((_, i) => (
                  <TableRow
                    key={i}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((exam) => (
                  <TableRow
                    key={exam.id}
                    className="cursor-pointer"
                    onClick={() => {
                      navigate({
                        to: "/clients/$clientId/exams/$examId",
                        params: {
                          clientId: String(exam.client_id),
                          examId: String(exam.id),
                        },
                      });
                    }}
                  >
                    <TableCell>
                      {exam.exam_date
                        ? new Date(exam.exam_date).toLocaleDateString("he-IL")
                        : ""}
                    </TableCell>
                    <TableCell>{exam.test_name}</TableCell>
                    {clientId === 0 && (
                      <TableCell className="cursor-pointer text-blue-600 hover:underline"
                        onClick={e => {
                          e.stopPropagation();
                          if (exam.client_id) {
                            navigate({ to: "/clients/$clientId", params: { clientId: String(exam.client_id) }, search: { tab: 'exams' } })
                          }
                        }}
                      >{exam.clientName}</TableCell>
                    )}
                    <TableCell>{exam.clinic}</TableCell>
                    <TableCell>{exam.full_name || exam.username}</TableCell>
                    <TableCell>
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => {
                        e.stopPropagation();
                        setExamToDelete(exam);
                        setIsDeleteModalOpen(true);
                      }} title="מחיקה">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={clientId === 0 ? 6 : 5} className="h-24 text-center">
                    לא נמצאו בדיקות לתצוגה
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        
      </div>

      {pagination && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            עמוד {pagination.page} מתוך {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 1)))} · סה"כ {pagination.total || 0}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page <= 1}
              onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}
            >הקודם</Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page >= Math.ceil((pagination.total || 0) / (pagination.pageSize || 1))}
              onClick={() => pagination.setPage(pagination.page + 1)}
            >הבא</Button>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת בדיקה"
        description={examToDelete ? `האם אתה בטוח שברצונך למחוק את הבדיקה של ${examToDelete.test_name || 'בדיקה זו'} מיום ${examToDelete.exam_date ? new Date(examToDelete.exam_date).toLocaleDateString('he-IL') : ''}? פעולה זו אינה הפיכה.` : "האם אתה בטוח שברצונך למחוק בדיקה זו? פעולה זו אינה הפיכה."}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
      />
    </div>
  );
}
