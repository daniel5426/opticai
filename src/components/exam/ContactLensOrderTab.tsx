import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { LookupSelect } from "@/components/ui/lookup-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status";
import { Clinic, User } from "@/lib/db/schema-interface";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { DateInput } from "@/components/ui/date";

type ContactLensOrderFields = {
  supply_in_clinic_id?: number;
  order_status?: string;
  advisor?: string;
  deliverer?: string;
  delivery_date?: string;
  priority?: string;
  guaranteed_date?: string;
  approval_date?: string;
  cleaning_solution?: string;
  disinfection_solution?: string;
  rinsing_solution?: string;
};

interface ContactLensOrderTabProps {
  contactLensOrder: ContactLensOrderFields;
  onContactLensOrderChange: (
    field: keyof ContactLensOrderFields,
    value: string,
  ) => void;
  isEditing: boolean;
  users: User[];
}

import { FastInput } from "./shared/OptimizedInputs";

const fieldClass =
  "mt-1.5 h-9 w-full text-sm disabled:cursor-default disabled:opacity-100";
const labelClass = "text-sm text-muted-foreground block text-right";
const viewFieldClass =
  "mt-1.5 flex h-9 w-full items-center rounded-md border bg-accent/50 px-3 text-sm";

export function ContactLensOrderTab({
  contactLensOrder,
  onContactLensOrderChange,
  isEditing,
  users,
}: ContactLensOrderTabProps) {
  const { currentUser, currentClinic } = useUser();
  const [companyClinics, setCompanyClinics] = useState<Clinic[]>([]);
  const [isLoadingCompanyClinics, setIsLoadingCompanyClinics] = useState(false);

  const advisorDefault = useMemo(
    () => currentUser?.full_name || currentUser?.username || "",
    [currentUser?.full_name, currentUser?.username],
  );
  const effectiveCompanyId =
    currentUser?.company_id ?? currentClinic?.company_id;
  const workerOptions = useMemo(() => {
    const names = users
      .filter((user) => user.id)
      .map((user) => user.full_name || user.username)
      .filter((name): name is string => Boolean(name));

    if (contactLensOrder.advisor) names.unshift(contactLensOrder.advisor);
    if (contactLensOrder.deliverer) names.unshift(contactLensOrder.deliverer);

    return Array.from(new Set(names));
  }, [contactLensOrder.advisor, contactLensOrder.deliverer, users]);

  const handleFieldChange = (
    field: keyof ContactLensOrderFields,
    value: string,
  ) => {
    onContactLensOrderChange(field, value);
  };

  const formatDateValue = (value?: string) => {
    if (!value) return "—";
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoMatch) return value;
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  };

  const renderViewField = (value?: string) => (
    <div className={viewFieldClass}>{value || "—"}</div>
  );

  const clinicName =
    companyClinics.find(
      (clinic) =>
        String(clinic.id) === String(contactLensOrder.supply_in_clinic_id),
    )?.name || "";

  useEffect(() => {
    let isMounted = true;

    const loadClinics = async () => {
      if (!effectiveCompanyId) {
        if (isMounted) setCompanyClinics([]);
        return;
      }

      setIsLoadingCompanyClinics(true);
      try {
        const response =
          await apiClient.getClinicsByCompany(effectiveCompanyId);
        if (!isMounted) return;

        setCompanyClinics(
          (response.data || []).filter((clinic) => clinic.is_active !== false),
        );
      } catch (error) {
        if (isMounted) setCompanyClinics([]);
        console.error("Failed to load company clinics", error);
      } finally {
        if (isMounted) setIsLoadingCompanyClinics(false);
      }
    };

    loadClinics();

    return () => {
      isMounted = false;
    };
  }, [effectiveCompanyId]);

  return (
    <Card className="examcard dark:bg-card w-full gap-2 pt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-center font-medium">
          פרטי ההזמנה
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="supply_in_clinic_id" className={labelClass}>
              אספקה בסניף
            </Label>
            {isEditing ? (
              <Select
                dir="rtl"
                disabled={
                  isLoadingCompanyClinics || companyClinics.length === 0
                }
                value={
                  contactLensOrder.supply_in_clinic_id
                    ? String(contactLensOrder.supply_in_clinic_id)
                    : ""
                }
                onValueChange={(value) =>
                  handleFieldChange("supply_in_clinic_id", value)
                }
              >
                <SelectTrigger className={`${fieldClass} bg-white text-right`}>
                  <SelectValue
                    placeholder={
                      isLoadingCompanyClinics ? "טוען סניפים..." : "בחר סניף"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companyClinics.map((clinic) => (
                    <SelectItem
                      key={clinic.id ?? clinic.name}
                      value={String(clinic.id)}
                    >
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              renderViewField(clinicName)
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="order_status" className={labelClass}>
              סטטוס הזמנה
            </Label>
            {isEditing ? (
              <Select
                dir="rtl"
                value={contactLensOrder.order_status || ""}
                onValueChange={(value) =>
                  handleFieldChange("order_status", value)
                }
              >
                <SelectTrigger className={`${fieldClass} bg-white text-right`}>
                  <SelectValue placeholder="בחר סטטוס" />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              renderViewField(contactLensOrder.order_status)
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="advisor" className={labelClass}>
              שם המוכר
            </Label>
            {isEditing ? (
              <Select
                dir="rtl"
                value={contactLensOrder.advisor || ""}
                onValueChange={(value) => handleFieldChange("advisor", value)}
              >
                <SelectTrigger className={`${fieldClass} bg-white text-right`}>
                  <SelectValue placeholder="בחר מוכר" />
                </SelectTrigger>
                <SelectContent>
                  {workerOptions.map((name) => (
                    <SelectItem key={`advisor-${name}`} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              renderViewField(contactLensOrder.advisor)
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverer" className={labelClass}>
              שם מוסר העבודה
            </Label>
            {isEditing ? (
              <Select
                dir="rtl"
                value={contactLensOrder.deliverer || ""}
                onValueChange={(value) => handleFieldChange("deliverer", value)}
              >
                <SelectTrigger className={`${fieldClass} bg-white text-right`}>
                  <SelectValue placeholder="בחר עובד" />
                </SelectTrigger>
                <SelectContent>
                  {workerOptions.map((name) => (
                    <SelectItem key={`deliverer-${name}`} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              renderViewField(contactLensOrder.deliverer)
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cleaning_solution" className={labelClass}>
              תמיסת ניקוי
            </Label>
            {isEditing ? (
              <LookupSelect
                lookupType="cleaningSolution"
                value={contactLensOrder.cleaning_solution || ""}
                onChange={(value) =>
                  handleFieldChange("cleaning_solution", value)
                }
                placeholder="בחר תמיסת ניקוי"
                className={`${fieldClass} text-right`}
                disabled={false}
              />
            ) : (
              renderViewField(contactLensOrder.cleaning_solution)
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="disinfection_solution" className={labelClass}>
              תמיסת חיטוי
            </Label>
            {isEditing ? (
              <LookupSelect
                lookupType="disinfectionSolution"
                value={contactLensOrder.disinfection_solution || ""}
                onChange={(value) =>
                  handleFieldChange("disinfection_solution", value)
                }
                placeholder="בחר תמיסת חיטוי"
                className={`${fieldClass} text-right`}
                disabled={false}
              />
            ) : (
              renderViewField(contactLensOrder.disinfection_solution)
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rinsing_solution" className={labelClass}>
              תמיסת שטיפה
            </Label>
            {isEditing ? (
              <LookupSelect
                lookupType="rinsingSolution"
                value={contactLensOrder.rinsing_solution || ""}
                onChange={(value) =>
                  handleFieldChange("rinsing_solution", value)
                }
                placeholder="בחר תמיסת שטיפה"
                className={`${fieldClass} text-right`}
                disabled={false}
              />
            ) : (
              renderViewField(contactLensOrder.rinsing_solution)
            )}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="delivery_date" className={labelClass}>
                  תאריך משלוח
                </Label>
                {isEditing ? (
                  <DateInput
                    name="delivery_date"
                    value={contactLensOrder.delivery_date || ""}
                    onChange={(e) =>
                      handleFieldChange("delivery_date", e.target.value)
                    }
                    className={`${fieldClass} bg-white`}
                    disabled={false}
                  />
                ) : (
                  renderViewField(
                    formatDateValue(contactLensOrder.delivery_date),
                  )
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority" className={labelClass}>
                  עדיפות
                </Label>
                {isEditing ? (
                  <FastInput
                    id="priority"
                    value={contactLensOrder.priority || ""}
                    onChange={(val) => handleFieldChange("priority", val)}
                    className={`${fieldClass} bg-white text-right`}
                    dir="rtl"
                    disabled={false}
                  />
                ) : (
                  renderViewField(contactLensOrder.priority)
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
