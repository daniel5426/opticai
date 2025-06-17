import React from "react";
import { useState } from "react";
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
import { MoreHorizontal, Trash2 } from "lucide-react";
import { ContactLens } from "@/lib/db/schema";
import { deleteContactLens } from "@/lib/db/contact-lens-db";
import { toast } from "sonner";

interface ContactLensTableProps {
  data: ContactLens[];
  clientId: number;
  onContactLensDeleted?: () => void;
}

export function ContactLensTable({
  data,
  clientId,
  onContactLensDeleted,
}: ContactLensTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleDeleteContactLens = async (
    contactLensId: number,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    if (window.confirm("האם אתה בטוח שברצונך למחוק את בדיקת עדשות המגע הזו?")) {
      try {
        const success = await deleteContactLens(contactLensId);
        if (success) {
          toast.success("בדיקת עדשות המגע נמחקה בהצלחה");
          if (onContactLensDeleted) {
            onContactLensDeleted();
          }
        } else {
          toast.error("שגיאה במחיקת בדיקת עדשות המגע");
        }
      } catch (error) {
        console.error("Error deleting contact lens:", error);
        toast.error("שגיאה במחיקת בדיקת עדשות המגע");
      }
    }
  };

  const filteredData = data.filter((contactLens) => {
    const searchableFields = [
      contactLens.type || "",
      contactLens.exam_date || "",
      contactLens.examiner_name || "",
    ];

    return searchableFields.some((field) =>
      field.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  });

  return (
    <div className="space-y-4" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center justify-between">
        <Link
          to="/clients/$clientId/contact-lenses/new"
          params={{ clientId: String(clientId) }}
        >
          <Button>עדשות מגע חדש</Button>
        </Link>
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש עדשות מגע..."
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
              <TableHead className="text-right">סוג עדשה</TableHead>
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">VA</TableHead>
              <TableHead className="text-right">קוטר קרנית</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  לא נמצאו בדיקות עדשות מגע לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((contactLens) => {
                return (
                  <TableRow
                    key={contactLens.id}
                    className="cursor-pointer"
                    onClick={() => {
                      navigate({
                        to: "/clients/$clientId/contact-lenses/$contactLensId",
                        params: {
                          clientId: String(clientId),
                          contactLensId: String(contactLens.id),
                        },
                      });
                    }}
                  >
                    <TableCell>
                      {contactLens.exam_date
                        ? new Date(contactLens.exam_date).toLocaleDateString(
                            "he-IL",
                          )
                        : ""}
                    </TableCell>
                    <TableCell>{contactLens.type}</TableCell>
                    <TableCell>{contactLens.examiner_name}</TableCell>
                    <TableCell></TableCell>
                    <TableCell>{contactLens.corneal_diameter}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">פתח תפריט</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link
                            to="/clients/$clientId/contact-lenses/$contactLensId"
                            params={{
                              clientId: String(clientId),
                              contactLensId: String(contactLens.id),
                            }}
                          >
                            <DropdownMenuItem>פרטי עדשות מגע</DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            className="text-red-600 focus:text-red-600"
                            onClick={(e) =>
                              handleDeleteContactLens(contactLens.id!, e)
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            מחק בדיקה
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
