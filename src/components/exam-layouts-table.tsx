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
import { MoreHorizontal, Plus } from "lucide-react";
import { ExamLayout } from "@/lib/db/schema";

interface ExamLayoutsTableProps {
  data: ExamLayout[];
  onRefresh: () => void;
}

export function ExamLayoutsTable({ data, onRefresh }: ExamLayoutsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const filteredData = data.filter((layout) => {
    return layout.name && layout.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateNew = () => {
    const layoutCount = data.length + 1;
    navigate({
      to: "/exam-layouts/new",
      search: { name: `פריסה ${layoutCount}` }
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש פריסות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px]"
            dir="rtl"
          />
        </div>
        <Button onClick={handleCreateNew}>
          פריסה חדשה
          <Plus className="h-4 w-4 mr-2" />
        </Button>
      </div>

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם הפריסה</TableHead>
              <TableHead className="text-right">ברירת מחדל</TableHead>
              <TableHead className="text-right">תאריך יצירה</TableHead>
              <TableHead className="text-right">עדכון אחרון</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  לא נמצאו פריסות לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((layout) => (
                <TableRow
                  key={layout.id}
                  className="cursor-pointer"
                  onClick={() => {
                    navigate({
                      to: "/exam-layouts/$layoutId",
                      params: { layoutId: String(layout.id) },
                    });
                  }}
                >
                  <TableCell className="font-medium">{layout.name}</TableCell>
                  <TableCell>{layout.is_default ? "כן" : "לא"}</TableCell>
                  <TableCell>
                    {layout.created_at
                      ? new Date(layout.created_at).toLocaleDateString("he-IL")
                      : ""}
                  </TableCell>
                  <TableCell>
                    {layout.updated_at
                      ? new Date(layout.updated_at).toLocaleDateString("he-IL")
                      : ""}
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
                          to="/exam-layouts/$layoutId"
                          params={{ layoutId: String(layout.id) }}
                        >
                          <DropdownMenuItem>עריכה</DropdownMenuItem>
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