import React, { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Referral } from "@/lib/db/schema";
import { deleteReferral } from "@/lib/db/referral-db";
import { toast } from "sonner";
import { ClientSelectModal } from "@/components/ClientSelectModal";

interface ReferralTableProps {
  referrals: Referral[];
  onRefresh: () => void;
  clientId: number;
}

export function ReferralTable({
  referrals,
  onRefresh,
  clientId,
}: ReferralTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();

  const filteredReferrals = referrals.filter(
    (referral) =>
      referral.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.branch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.date?.includes(searchTerm),
  );

  const handleDeleteClick = async (
    referral: Referral,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    if (window.confirm("האם אתה בטוח שברצונך למחוק את ההפניה הזו?")) {
      try {
        const success = await deleteReferral(referral.id!);
        if (success) {
          toast.success("ההפניה נמחקה בהצלחה");
          onRefresh();
        } else {
          toast.error("לא הצלחנו למחוק את ההפניה");
        }
      } catch (error) {
        console.error("Error deleting referral:", error);
        toast.error("לא הצלחנו למחוק את ההפניה");
      }
    }
  };

  const handleRowClick = (referralId: number) => {
    navigate({ to: `/referrals/${referralId}` });
  };

  return (
    <div className="space-y-4" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center justify-between">
        <Input
          placeholder="חיפוש הפניות..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-[250px]"
          dir="rtl"
        />
                {clientId > 0 ? (
          <Link to="/referrals/create" search={{ clientId: String(clientId) }}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              הפניה חדשה
            </Button>
          </Link>
        ) : (
          <ClientSelectModal
            triggerText="הפניה חדשה"
            onClientSelect={(selectedClientId) => {
              navigate({
                to: "/referrals/create",
                search: { clientId: String(selectedClientId) },
              });
            }}
          />
        )}
      </div>

      <div
        className="overflow-hidden rounded-lg border"
        style={{ scrollbarWidth: "none" }}
      >
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">סוג הפניה</TableHead>
              <TableHead className="text-right">סניף</TableHead>
              <TableHead className="text-right">נמען</TableHead>
              <TableHead className="text-right">VA משולב</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReferrals.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-muted-foreground py-8 text-center"
                >
                  לא נמצאו הפניות
                </TableCell>
              </TableRow>
            ) : (
              filteredReferrals.map((referral) => (
                <TableRow
                  key={referral.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(referral.id!)}
                >
                  <TableCell className="text-right">
                    {referral.date
                      ? new Date(referral.date).toLocaleDateString("he-IL")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {referral.type || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {referral.branch || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {referral.recipient || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {referral.comb_va || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/referrals/$referralId"
                            params={{ referralId: String(referral.id) }}
                            className="cursor-pointer"
                          >
                            צפה/ערוך
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteClick(referral, e)}
                          className="cursor-pointer text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          מחק
                        </DropdownMenuItem>
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
