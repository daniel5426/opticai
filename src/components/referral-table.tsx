import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
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
import { Referral, Client } from "@/lib/db/schema";
import { deleteReferral } from "@/lib/db/referral-db";
import { getAllClients } from "@/lib/db/clients-db";
import { toast } from "sonner";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { CustomModal } from "@/components/ui/custom-modal";
import { Skeleton } from "@/components/ui/skeleton";

interface ReferralTableProps {
  referrals: Referral[];
  onReferralDeleted: (referralId: number) => void;
  onReferralDeleteFailed: () => void;
  clientId: number;
  loading: boolean;
}

export function ReferralTable({
  referrals,
  onReferralDeleted,
  onReferralDeleteFailed,
  clientId,
  loading,
}: ReferralTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [referralToDelete, setReferralToDelete] = useState<Referral | null>(null);

  useEffect(() => {
    const loadClients = async () => {
      try {
        const clientsData = await getAllClients();
        setClients(clientsData);
      } catch (error) {
        console.error('Error loading clients:', error);
      }
    };
    loadClients();
  }, []);

  const getClientName = (clientId: number): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.first_name} ${client.last_name}`.trim() : '';
  };

  const filteredReferrals = referrals.filter(
    (referral) =>
      referral.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.recipient?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.branch?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      referral.date?.includes(searchTerm),
  );

  const handleDeleteConfirm = async () => {
    if (referralToDelete && referralToDelete.id !== undefined) {
      try {
        const deletedReferralId = referralToDelete.id;
        onReferralDeleted(deletedReferralId);
        toast.success("ההפניה נמחקה בהצלחה");

        const success = await deleteReferral(deletedReferralId);
        if (!success) {
          toast.error("לא הצלחנו למחוק את ההפניה. מרענן נתונים...");
          onReferralDeleteFailed();
        }
      } catch (error) {
        console.error("Error deleting referral:", error);
        toast.error("לא הצלחנו למחוק את ההפניה");
        onReferralDeleteFailed();
      } finally {
        setReferralToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  };

  const handleRowClick = (referral: Referral) => {
    navigate({ to: "/referrals/$referralId", params: { referralId: String(referral.id) } });
  };

  return (
    <div className="space-y-4" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center justify-between" dir="rtl">
        <Input
          placeholder="חיפוש הפניות..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-[250px] bg-card dark:bg-card"
          dir="rtl"
        />
        {clientId > 0 ? (
          <Link to="/referrals/create" search={{ clientId: String(clientId) }}>
            <Button>
              הפניה חדשה
              <Plus className="mr-2 h-4 w-4" />
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
        className="overflow-hidden rounded-lg border bg-card"
        style={{ scrollbarWidth: "none" }}
      >
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">סוג הפניה</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right">סניף</TableHead>
              <TableHead className="text-right">נמען</TableHead>
              <TableHead className="text-right">VA משולב</TableHead>
              <TableHead className="text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                </TableRow>
              ))
            ) : filteredReferrals.length > 0 ? (
              filteredReferrals.map((referral) => (
                <TableRow
                  key={referral.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(referral)}
                >
                  <TableCell className="text-right">
                    {referral.date
                      ? new Date(referral.date).toLocaleDateString("he-IL")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {referral.type || "-"}
                  </TableCell>
                  {clientId === 0 && (
                    <TableCell className="cursor-pointer text-blue-600 hover:underline"
                      onClick={e => {
                        e.stopPropagation();
                        if (referral.client_id) {
                          navigate({ to: "/clients/$clientId", params: { clientId: String(referral.client_id) }, search: { tab: 'referrals' } })
                        }
                      }}
                    >{getClientName(referral.client_id)}</TableCell>
                  )}
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
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReferralToDelete(referral);
                        setIsDeleteModalOpen(true);
                      }}
                      title="מחיקה"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={clientId === 0 ? 7 : 6}
                  className="text-muted-foreground py-8 text-center"
                >
                  לא נמצאו הפניות
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת הפניה"
        description={referralToDelete ? `האם אתה בטוח שברצונך למחוק את ההפניה אל "${referralToDelete.recipient}"?` : "האם אתה בטוח שברצונך למחוק את ההפניה?"}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />
    </div>
  );
}
