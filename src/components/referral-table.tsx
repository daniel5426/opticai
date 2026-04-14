import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Referral } from "@/lib/db/schema-interface";
import { deleteReferral } from "@/lib/db/referral-db";
import { toast } from "sonner";
import { ClientSelectModal } from "@/components/ClientSelectModal";
import { CustomModal } from "@/components/ui/custom-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { TableFiltersBar } from "@/components/table-filters-bar";
import { ALL_FILTER_VALUE, REFERRAL_URGENCY_OPTIONS } from "@/lib/table-filters";

interface ReferralTableProps {
  referrals: Referral[];
  onReferralDeleted: (referralId: number) => void;
  onReferralDeleteFailed: () => void;
  clientId: number;
  loading: boolean;
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void };
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  urgencyFilter?: string;
  onUrgencyFilterChange?: (value: string) => void;
  referralTypeFilter?: string;
  onReferralTypeFilterChange?: (value: string) => void;
}

export function ReferralTable({
  referrals,
  onReferralDeleted,
  onReferralDeleteFailed,
  clientId,
  loading,
  pagination,
  searchQuery: externalSearch,
  onSearchChange,
  urgencyFilter: externalUrgencyFilter,
  onUrgencyFilterChange,
  referralTypeFilter: externalReferralTypeFilter,
  onReferralTypeFilterChange,
}: ReferralTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const searchValue = externalSearch !== undefined ? externalSearch : searchTerm;
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [referralToDelete, setReferralToDelete] = useState<Referral | null>(null);
  const [selectedUrgency, setSelectedUrgency] = useState<string>(ALL_FILTER_VALUE);
  const [selectedReferralType, setSelectedReferralType] = useState<string>(ALL_FILTER_VALUE);
  const urgencyFilter = externalUrgencyFilter ?? selectedUrgency;
  const referralTypeFilter = externalReferralTypeFilter ?? selectedReferralType;

  const handleUrgencyFilterChange = (value: string) => {
    if (onUrgencyFilterChange) {
      onUrgencyFilterChange(value);
      return;
    }
    setSelectedUrgency(value);
  };

  const handleReferralTypeFilterChange = (value: string) => {
    if (onReferralTypeFilterChange) {
      onReferralTypeFilterChange(value);
      return;
    }
    setSelectedReferralType(value);
  };

  const referralTypeOptions = React.useMemo(() => {
    return Array.from(new Set(referrals.map((referral) => referral.type).filter(Boolean)));
  }, [referrals]);

  const filteredReferrals = React.useMemo(() => {
    return referrals.filter((referral) => {
      if (urgencyFilter !== ALL_FILTER_VALUE && referral.urgency_level !== urgencyFilter) {
        return false;
      }
      if (referralTypeFilter !== ALL_FILTER_VALUE && referral.type !== referralTypeFilter) {
        return false;
      }

      const normalizedSearch = searchValue.toLowerCase().trim();
      if (!normalizedSearch) {
        return true;
      }

      return (
        referral.type?.toLowerCase().includes(normalizedSearch) ||
        referral.recipient?.toLowerCase().includes(normalizedSearch) ||
        referral.urgency_level?.toLowerCase().includes(normalizedSearch) ||
        referral.date?.includes(searchValue) ||
        referral.client_full_name?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [referralTypeFilter, referrals, searchValue, urgencyFilter]);

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
    if (!referral.client_id) return;
    navigate({ to: "/clients/$clientId/referrals/$referralId", params: { clientId: String(referral.client_id), referralId: String(referral.id) } });
  };

  return (
    <div className="space-y-2.5 mb-10" style={{ scrollbarWidth: "none" }}>
      <TableFiltersBar
        searchValue={searchValue}
        onSearchChange={(value) => (onSearchChange ? onSearchChange(value) : setSearchTerm(value))}
        searchPlaceholder="חיפוש הפניות…"
        filters={[
          {
            key: "urgency",
            value: urgencyFilter,
            onChange: handleUrgencyFilterChange,
            placeholder: "דחיפות",
            options: REFERRAL_URGENCY_OPTIONS,
            widthClassName: "w-[160px]",
          },
          {
            key: "type",
            value: referralTypeFilter,
            onChange: handleReferralTypeFilterChange,
            placeholder: "סוג הפניה",
            options: [
              { value: ALL_FILTER_VALUE, label: "כל הסוגים" },
              ...referralTypeOptions.map((type) => ({ value: type || "unknown", label: type || "unknown" })),
            ],
            widthClassName: "w-[190px]",
          },
        ]}
        hasActiveFilters={Boolean(searchValue.trim()) || urgencyFilter !== ALL_FILTER_VALUE || referralTypeFilter !== ALL_FILTER_VALUE}
        onReset={() => {
          if (onSearchChange) onSearchChange("");
          else setSearchTerm("");
          handleUrgencyFilterChange(ALL_FILTER_VALUE);
          handleReferralTypeFilterChange(ALL_FILTER_VALUE);
        }}
        actions={
          clientId > 0 ? (
            <Link to="/clients/$clientId/referrals/new" params={{ clientId: String(clientId) }}>
              <Button>
                הפניה חדשה
                <Plus className="mr-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <ClientSelectModal
              triggerText="הפניה חדשה"
              onClientSelect={(selectedClientId) => {
                navigate({ to: "/clients/$clientId/referrals/new", params: { clientId: String(selectedClientId) } });
              }}
            />
          )
        }
      />

      <div
        className="overflow-hidden rounded-lg bg-card"
        style={{ scrollbarWidth: "none" }}
      >
        <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: 'none' }}>
          <TableHeader className="sticky top-0  bg-card">
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">סוג הפניה</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right">רמת דחיפות</TableHead>
              <TableHead className="text-right">נמען</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  {clientId === 0 && (
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  )}
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
                    >{referral.client_full_name || ''}</TableCell>
                  )}
                  <TableCell className="text-right">
                    {referral.urgency_level ? (
                      referral.urgency_level === 'routine' ? 'שגרתי' :
                      referral.urgency_level === 'urgent' ? 'דחוף' :
                      referral.urgency_level === 'emergency' ? 'חירום' : referral.urgency_level
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {referral.recipient || "-"}
                  </TableCell>
                  <TableCell>
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
                  colSpan={clientId === 0 ? 6 : 5}
                  className="h-24 text-center text-muted-foreground"
                >
                  לא נמצאו הפניות
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
        title="מחיקת הפניה"
        description={referralToDelete ? `האם אתה בטוח שברצונך למחוק את ההפניה אל "${referralToDelete.recipient}"?` : "האם אתה בטוח שברצונך למחוק את ההפניה?"}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />
    </div>
  );
}
