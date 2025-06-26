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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Plus } from "lucide-react";
import { OpticalExam, User } from "@/lib/db/schema";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { getAllUsers } from "@/lib/db/users-db";

interface ExamsTableProps {
  data: OpticalExam[];
  clientId: number;
}

export function ExamsTable({ data, clientId }: ExamsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await getAllUsers();
        setUsers(usersData);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    };
    loadUsers();
  }, []);

  const getUserName = (userId?: number): string => {
    if (!userId) return '';
    const user = users.find(u => u.id === userId);
    return user?.username || '';
  };

  // Filter data based on search query
  const filteredData = data.filter((exam) => {
    const searchableFields = [
      getUserName(exam.user_id),
      exam.clinic,
      exam.test_name,
      exam.exam_date,
    ];

    return searchableFields.some(
      (field) =>
        field && field.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש בדיקות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px]"
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

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך בדיקה</TableHead>
              <TableHead className="text-right">סוג בדיקה</TableHead>
                              <TableHead className="text-right">סניף</TableHead>
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  לא נמצאו בדיקות לתצוגה
                </TableCell>
              </TableRow>
            ) : (
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
                  <TableCell>{exam.clinic}</TableCell>
                  <TableCell>{getUserName(exam.user_id)}</TableCell>
                  <TableCell>
                    {exam.notes && exam.notes.length > 30
                      ? `${exam.notes.substring(0, 30)}...`
                      : exam.notes}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">פתח תפריט</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <Link
                          to="/clients/$clientId/exams/$examId"
                          params={{
                            clientId: String(exam.client_id),
                            examId: String(exam.id),
                          }}
                        >
                          <DropdownMenuItem>פרטי בדיקה</DropdownMenuItem>
                        </Link>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
