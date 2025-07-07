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
import { ContactLens, User, Client } from "@/lib/db/schema";
import { deleteContactLens } from "@/lib/db/contact-lens-db";
import { toast } from "sonner";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { getAllUsers } from "@/lib/db/users-db";
import { getAllClients } from "@/lib/db/clients-db";
import { CustomModal } from "@/components/ui/custom-modal";

interface ContactLensTableProps {
  data: ContactLens[];
  clientId: number;
  onContactLensDeleted: (id: number) => void;
  onContactLensDeleteFailed: () => void;
  loading: boolean;
}

export function ContactLensTable({
  data,
  clientId,
  onContactLensDeleted,
  onContactLensDeleteFailed,
  loading
}: ContactLensTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [contactLensToDelete, setContactLensToDelete] = useState<ContactLens | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, clientsData] = await Promise.all([
          getAllUsers(),
          getAllClients()
        ]);
        setUsers(usersData);
        setClients(clientsData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);

  const getUserName = (userId?: number): string => {
    if (!userId) return '';
    const user = users.find(u => u.id === userId);
    return user?.username || '';
  };

  const getClientName = (clientId: number): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? `${client.first_name} ${client.last_name}`.trim() : '';
  };

  const handleDeleteConfirm = async () => {
    if (contactLensToDelete && contactLensToDelete.id !== undefined) {
      try {
        const deletedContactLensId = contactLensToDelete.id;
        onContactLensDeleted(deletedContactLensId);
        toast.success("בדיקת עדשות המגע נמחקה בהצלחה");

        const success = await deleteContactLens(deletedContactLensId);
        if (!success) {
          toast.error("שגיאה במחיקת בדיקת עדשות המגע. מרענן נתונים...");
          onContactLensDeleteFailed();
        }
      } catch (error) {
        console.error("Error deleting contact lens:", error);
        toast.error("שגיאה במחיקת בדיקת עדשות המגע");
        onContactLensDeleteFailed();
      } finally {
        setContactLensToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  };

  const filteredData = data.filter((contactLens) => {
    const searchableFields = [
      contactLens.type || "",
      contactLens.exam_date || "",
      getUserName(contactLens.user_id),
    ];

    return searchableFields.some((field) =>
      field.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  });

  return (
    <div className="space-y-4" style={{ scrollbarWidth: "none" }}>
      <div className="flex items-center justify-between" dir="rtl">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש עדשות מגע..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px] bg-card dark:bg-card"
            dir="rtl"
          />
        </div>
        {clientId > 0 ? (
          <Link
            to="/clients/$clientId/contact-lenses/new"
            params={{ clientId: String(clientId) }}
          >
            <Button>עדשות מגע חדש
              <Plus className="h-4 w-4 mr-2" />
              </Button>
          </Link>
        ) : (
          <ClientSelectModal
            triggerText="עדשות מגע חדש"
            onClientSelect={(selectedClientId) => {
              navigate({
                to: "/clients/$clientId/contact-lenses/new",
                params: { clientId: String(selectedClientId) },
              });
            }}
          />
        )}

      </div>

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך בדיקה</TableHead>
              <TableHead className="text-right">סוג עדשה</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">VA</TableHead>
              <TableHead className="text-right">קוטר קרנית</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                </TableRow>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((contactLens) => {
                return (
                  <TableRow
                    key={contactLens.id}
                    className="cursor-pointer"
                    onClick={() => {
                      navigate({
                        to: "/clients/$clientId/contact-lenses/$contactLensId",
                        params: {
                          clientId: String(contactLens.client_id),
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
                    {clientId === 0 && (
                      <TableCell className="cursor-pointer text-blue-600 hover:underline"
                        onClick={e => {
                          e.stopPropagation();
                          if (contactLens.client_id) {
                            navigate({ to: "/clients/$clientId", params: { clientId: String(contactLens.client_id) }, search: { tab: 'contact-lenses' } })
                          }
                        }}
                      >{getClientName(contactLens.client_id)}</TableCell>
                    )}
                    <TableCell>{getUserName(contactLens.user_id)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell>{contactLens.corneal_diameter}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContactLensToDelete(contactLens);
                          setIsDeleteModalOpen(true);
                        }}
                        title="מחיקה"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={clientId === 0 ? 7 : 6} className="h-24 text-center text-muted-foreground">
                  לא נמצאו בדיקות עדשות מגע לתצוגה
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת בדיקת עדשות מגע"
        description={contactLensToDelete ? `האם אתה בטוח שברצונך למחוק את בדיקת עדשות המגע מיום ${contactLensToDelete.exam_date ? new Date(contactLensToDelete.exam_date).toLocaleDateString('he-IL') : ''}?` : "האם אתה בטוח שברצונך למחוק את הבדיקה?"}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />
    </div>
  );
}
