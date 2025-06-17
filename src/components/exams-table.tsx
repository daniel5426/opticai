import React, { useState } from "react";
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
import { MoreHorizontal } from "lucide-react";
import { OpticalExam } from "@/lib/db/schema";

interface ExamsTableProps {
  data: OpticalExam[];
  clientId: number;
}

export function ExamsTable({ data, clientId }: ExamsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Filter data based on search query
  const filteredData = data.filter((exam) => {
    const searchableFields = [
      exam.examiner_name,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          to="/clients/$clientId/exams/new"
          params={{ clientId: String(clientId) }}
        >
          <Button>בדיקה חדשה</Button>
        </Link>
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש בדיקות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px]"
            dir="rtl"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך בדיקה</TableHead>
              <TableHead className="text-right">סוג בדיקה</TableHead>
              <TableHead className="text-right">מרפאה</TableHead>
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
                        clientId: String(clientId),
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
                  <TableCell>{exam.examiner_name}</TableCell>
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
                            clientId: String(clientId),
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
