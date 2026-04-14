import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupSelect } from "@/components/ui/lookup-select";
import { DateInput } from "@/components/ui/date";
import { ExamToolbox } from "@/components/exam/ExamToolbox";
import { FinalPrescriptionTab } from "@/components/exam/FinalPrescriptionTab";
import { NotesCard } from "@/components/ui/notes-card";
import {
  Clinic,
  Order,
  FinalPrescriptionExam,
  User,
} from "@/lib/db/schema-interface";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status";

type OrderLens = {
  order_id: number;
  right_supplier?: string;
  left_supplier?: string;
  right_material?: string;
  left_material?: string;
  right_model?: string;
  left_model?: string;
  right_coating?: string;
  left_coating?: string;
  right_color?: string;
  left_color?: string;
  right_diameter?: string;
  left_diameter?: string;
  warranty_expiration?: string;
  // Legacy fields
  color?: string;
  coating?: string;
  material?: string;
  supplier?: string;
  manufacturer?: string;
  width?: string;
};

type Frame = {
  order_id: number;
  color?: string;
  supplier?: string;
  model?: string;
  manufacturer?: string;
  supplied_by?: string;
  bridge?: number;
  width?: number;
  height?: number;
  length?: number;
  warranty_expiration?: string;
};

type LensFrameTab = {
  id: string;
  type: string;
  lens: OrderLens;
  frame: Frame;
  created_at?: string;
  updated_at?: string;
};

type OrderDetails = {
  order_id: number;
  supplier_status?: string;
  bag_number?: string;
  advisor?: string;
  delivered_by?: string;
  technician?: string;
  delivered_at?: string;
  warranty_expiration?: string;
  delivery_clinic_id?: number;
  delivery_location?: string;
  manufacturing_lab?: string;
  order_status?: string;
  priority?: string;
  promised_date?: string;
  approval_date?: string;
  notes?: string;
  lens_order_notes?: string;
};

interface RegularOrderTabProps {
  formRef: React.RefObject<HTMLFormElement | null>;
  isEditing: boolean;
  users: User[];
  formData: Order;
  setFormData: React.Dispatch<React.SetStateAction<Order>>;
  onSelectChange: (value: string, name: string) => void;
  finalPrescriptionData: FinalPrescriptionExam;
  onFinalPrescriptionChange: (
    field: keyof FinalPrescriptionExam,
    value: string,
  ) => void;
  currentCard: { id: string; type: any };
  allRows: any;
  clipboardSourceType: any;
  onToolboxClearData: () => void;
  onToolboxCopy: () => void;
  onToolboxPaste: () => void;
  lensFrameTab: LensFrameTab;
  onLensFieldChange: (field: keyof OrderLens, value: string) => void;
  onFrameFieldChange: (field: keyof Frame, value: string) => void;
  orderDetailsFormData: OrderDetails;
  setOrderDetailsFormData: React.Dispatch<React.SetStateAction<OrderDetails>>;
  clientOrderIndex?: number | null;
}

export default function RegularOrderTab({
  formRef,
  isEditing,
  users,
  formData,
  setFormData,
  onSelectChange,
  finalPrescriptionData,
  onFinalPrescriptionChange,
  currentCard,
  allRows,
  clipboardSourceType,
  onToolboxClearData,
  onToolboxCopy,
  onToolboxPaste,
  lensFrameTab,
  onLensFieldChange,
  onFrameFieldChange,
  orderDetailsFormData,
  setOrderDetailsFormData,
  clientOrderIndex,
}: RegularOrderTabProps) {
  const [showAdvancedFrame, setShowAdvancedFrame] = useState<boolean>(false);
  const [companyClinics, setCompanyClinics] = useState<Clinic[]>([]);
  const [isLoadingCompanyClinics, setIsLoadingCompanyClinics] = useState(false);
  const { currentUser, currentClinic } = useUser();
  const activeLens = lensFrameTab?.lens || ({ order_id: 0 } as OrderLens);
  const activeFrame = lensFrameTab?.frame || ({ order_id: 0 } as Frame);
  const effectiveCompanyId =
    currentUser?.company_id ?? currentClinic?.company_id;

  useEffect(() => {
    let isMounted = true;

    const loadClinics = async () => {
      if (!effectiveCompanyId) {
        if (isMounted) {
          setCompanyClinics([]);
        }
        return;
      }

      setIsLoadingCompanyClinics(true);
      try {
        const response =
          await apiClient.getClinicsByCompany(effectiveCompanyId);
        if (!isMounted) return;

        const clinics = (response.data || []).filter(
          (clinic) => clinic.is_active !== false,
        );
        setCompanyClinics(clinics);
      } catch (error) {
        if (isMounted) {
          setCompanyClinics([]);
        }
        console.error("Failed to load company clinics", error);
      } finally {
        if (isMounted) {
          setIsLoadingCompanyClinics(false);
        }
      }
    };

    loadClinics();

    return () => {
      isMounted = false;
    };
  }, [effectiveCompanyId]);

  return (
    <form
      ref={formRef}
      className="no-scrollbar pt-4 pb-10"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5" dir="rtl">
          <div className="lg:col-span-2">
            <Card className="examcard h-full w-full pt-[8px] pb-1" dir="ltr">
              <CardContent className="px-4">
                <div className="space-y-3">
                  <div className="text-center">
                    <h3 className="text-muted-foreground font-medium">
                      פרטי הזמנה
                    </h3>
                  </div>
                  <div
                    className="grid w-full grid-cols-2 items-start gap-x-2 gap-y-5"
                    dir="rtl"
                  >
                    <div className="col-span-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        תאריך הזמנה
                      </label>
                      <div className="h-1"></div>
                      <DateInput
                        name="order_date"
                        className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"}`}
                        value={formData.order_date}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            order_date: e.target.value,
                          }))
                        }
                        disabled={!isEditing}
                      />
                    </div>

                    <div className="col-span-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        סוג הזמנה
                      </label>
                      <div className="h-1"></div>
                      {isEditing ? (
                        <LookupSelect
                          value={formData.type || ""}
                          onChange={(value) =>
                            setFormData((prev) => ({ ...prev, type: value }))
                          }
                          lookupType="orderType"
                          placeholder="סוג הזמנה..."
                          className="h-8 bg-white text-xs"
                        />
                      ) : (
                        <div className="bg-accent/50 flex h-8 items-center rounded-md border px-3 text-xs">
                          {formData.type || "לא נבחר"}
                        </div>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        עין דומיננטית
                      </label>
                      <div className="h-1"></div>
                      <Select
                        dir="rtl"
                        disabled={!isEditing}
                        value={formData.dominant_eye || ""}
                        onValueChange={(value) =>
                          onSelectChange(value, "dominant_eye")
                        }
                      >
                        <SelectTrigger
                          size="xs"
                          className={`h-8 w-full text-xs ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                        >
                          <SelectValue placeholder="בחר עין" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R" className="text-sm">
                            ימין
                          </SelectItem>
                          <SelectItem value="L" className="text-sm">
                            שמאל
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-1">
                      <label className="text-muted-foreground text-xs font-medium">
                        בודק
                      </label>
                      <div className="h-1"></div>
                      {isEditing ? (
                        <Select
                          dir="rtl"
                          value={
                            formData.user_id ? formData.user_id.toString() : ""
                          }
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              user_id: Number(value),
                            }))
                          }
                        >
                          <SelectTrigger className="h-8 w-full bg-white text-xs disabled:cursor-default disabled:opacity-100">
                            <SelectValue placeholder="בחר בודק" />
                          </SelectTrigger>
                          <SelectContent>
                            {users
                              .filter(
                                (u) => u.id !== undefined && u.id !== null,
                              )
                              .map((user) => (
                                <SelectItem
                                  key={user.id}
                                  value={user.id!.toString()}
                                  className="text-sm"
                                >
                                  {user.full_name || user.username}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="bg-accent/50 flex h-8 items-center rounded-md border px-3 text-xs">
                          {formData.user_id
                            ? users.find((u) => u.id === formData.user_id)
                                ?.full_name ||
                              users.find((u) => u.id === formData.user_id)
                                ?.username ||
                              "משתמש לא נמצא"
                            : "לא נבחר בודק"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="relative h-full lg:col-span-3">
            {isEditing && (
              <ExamToolbox
                isEditing={isEditing}
                mode="detail"
                currentCard={currentCard}
                allRows={allRows}
                currentRowIndex={0}
                currentCardIndex={0}
                clipboardSourceType={clipboardSourceType}
                onClearData={onToolboxClearData}
                onCopy={onToolboxCopy}
                onPaste={onToolboxPaste}
                onCopyLeft={() => {}}
                onCopyRight={() => {}}
                onCopyBelow={() => {}}
              />
            )}
            <FinalPrescriptionTab
              finalPrescriptionData={finalPrescriptionData}
              onFinalPrescriptionChange={(field, value) =>
                onFinalPrescriptionChange(
                  field as keyof FinalPrescriptionExam,
                  value,
                )
              }
              isEditing={isEditing}
              hideEyeLabels={false}
            />
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className="flex flex-col gap-6">
              <div className="w-full space-y-4">
                <Card className="pt-4">
                  <CardContent className="space-y-4">
                    <div className="space-y-6">
                      <div>
                        <CardHeader className="px-0 pt-0 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">
                                פרטי עדשות
                              </CardTitle>
                            </div>
                          </div>
                        </CardHeader>
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] md:items-end">
                            <div>
                              <Label className="text-sm">ספק ימין</Label>
                              <LookupSelect
                                value={activeLens.right_supplier || ""}
                                onChange={(value) =>
                                  onLensFieldChange("right_supplier", value)
                                }
                                lookupType="supplier"
                                placeholder="בחר או הקלד ספק..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">חומר ימין</Label>
                              <LookupSelect
                                value={activeLens.right_material || ""}
                                onChange={(value) =>
                                  onLensFieldChange("right_material", value)
                                }
                                lookupType="material"
                                placeholder="בחר או הקלד חומר..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">דגם ימין</Label>
                              <LookupSelect
                                value={activeLens.right_model || ""}
                                onChange={(value) =>
                                  onLensFieldChange("right_model", value)
                                }
                                lookupType="lensModel"
                                placeholder="בחר או הקלד דגם עדשה..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">ציפוי ימין</Label>
                              <LookupSelect
                                value={activeLens.right_coating || ""}
                                onChange={(value) =>
                                  onLensFieldChange("right_coating", value)
                                }
                                lookupType="coating"
                                placeholder="בחר או הקלד ציפוי..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">צבע ימין</Label>
                              <LookupSelect
                                value={activeLens.right_color || ""}
                                onChange={(value) =>
                                  onLensFieldChange("right_color", value)
                                }
                                lookupType="color"
                                placeholder="בחר או הקלד צבע..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div className="md:max-w-[120px]">
                              <Label className="text-sm">קוטר ימין</Label>
                              <Input
                                name="right_diameter"
                                type="number"
                                value={activeLens.right_diameter || ""}
                                onChange={(e) =>
                                  onLensFieldChange(
                                    "right_diameter",
                                    e.target.value,
                                  )
                                }
                                disabled={!isEditing}
                                className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] md:items-end">
                            <div>
                              <Label className="text-sm">ספק שמאל</Label>
                              <LookupSelect
                                value={activeLens.left_supplier || ""}
                                onChange={(value) =>
                                  onLensFieldChange("left_supplier", value)
                                }
                                lookupType="supplier"
                                placeholder="בחר או הקלד ספק..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">חומר שמאל</Label>
                              <LookupSelect
                                value={activeLens.left_material || ""}
                                onChange={(value) =>
                                  onLensFieldChange("left_material", value)
                                }
                                lookupType="material"
                                placeholder="בחר או הקלד חומר..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">דגם שמאל</Label>
                              <LookupSelect
                                value={activeLens.left_model || ""}
                                onChange={(value) =>
                                  onLensFieldChange("left_model", value)
                                }
                                lookupType="lensModel"
                                placeholder="בחר או הקלד דגם עדשה..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">ציפוי שמאל</Label>
                              <LookupSelect
                                value={activeLens.left_coating || ""}
                                onChange={(value) =>
                                  onLensFieldChange("left_coating", value)
                                }
                                lookupType="coating"
                                placeholder="בחר או הקלד ציפוי..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">צבע שמאל</Label>
                              <LookupSelect
                                value={activeLens.left_color || ""}
                                onChange={(value) =>
                                  onLensFieldChange("left_color", value)
                                }
                                lookupType="color"
                                placeholder="בחר או הקלד צבע..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div className="md:max-w-[120px]">
                              <Label className="text-sm">קוטר שמאל</Label>
                              <Input
                                name="left_diameter"
                                type="number"
                                value={activeLens.left_diameter || ""}
                                onChange={(e) =>
                                  onLensFieldChange(
                                    "left_diameter",
                                    e.target.value,
                                  )
                                }
                                disabled={!isEditing}
                                className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-border h-px w-full" />

                      <div>
                        <CardHeader className="px-0 pt-0 pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <CardTitle className="text-base">
                                פרטי מסגרת
                              </CardTitle>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setShowAdvancedFrame(!showAdvancedFrame)
                              }
                              className="text-primary border-none bg-transparent pt-1 text-xs outline-none hover:underline"
                            >
                              {showAdvancedFrame
                                ? "הסתר שדות מתקדמים"
                                : "הצג שדות מסגרת מתקדמים"}
                            </button>
                          </div>
                        </CardHeader>
                        <div className="space-y-3">
                          <div className="grid gap-3 md:grid-cols-4">
                            <div>
                              <Label className="text-sm">שם ספק</Label>
                              <LookupSelect
                                value={activeFrame.supplier || ""}
                                onChange={(value) =>
                                  onFrameFieldChange("supplier", value)
                                }
                                lookupType="supplier"
                                placeholder="בחר או הקלד ספק..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">מותג</Label>
                              <LookupSelect
                                value={activeFrame.manufacturer || ""}
                                onChange={(value) =>
                                  onFrameFieldChange("manufacturer", value)
                                }
                                lookupType="manufacturer"
                                placeholder="בחר או הקלד מותג..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">דגם</Label>
                              <LookupSelect
                                value={activeFrame.model || ""}
                                onChange={(value) =>
                                  onFrameFieldChange("model", value)
                                }
                                lookupType="frameModel"
                                placeholder="בחר או הקלד דגם מסגרת..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="pb-1.5 text-sm">גודל</Label>
                              <Input
                                name="frame_size"
                                type="number"
                                value={activeFrame.width || ""}
                                onChange={(e) =>
                                  onFrameFieldChange("width", e.target.value)
                                }
                                disabled={!isEditing}
                                className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-4">
                            <div>
                              <Label className="text-sm">צבע</Label>
                              <LookupSelect
                                value={activeFrame.color || ""}
                                onChange={(value) =>
                                  onFrameFieldChange("color", value)
                                }
                                lookupType="color"
                                placeholder="בחר או הקלד צבע..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">סופק על ידי</Label>
                              <Select
                                dir="rtl"
                                disabled={!isEditing}
                                value={activeFrame.supplied_by || "חנות"}
                                onValueChange={(value) =>
                                  onFrameFieldChange("supplied_by", value)
                                }
                              >
                                <SelectTrigger
                                  className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                >
                                  <SelectValue placeholder="בחר" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="חנות" className="text-sm">
                                    חנות
                                  </SelectItem>
                                  <SelectItem value="לקוח" className="text-sm">
                                    לקוח
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">
                                תום אחריות עדשות
                              </Label>
                              <DateInput
                                name="lens_warranty"
                                value={activeLens.warranty_expiration}
                                onChange={(e) =>
                                  onLensFieldChange(
                                    "warranty_expiration",
                                    e.target.value,
                                  )
                                }
                                disabled={!isEditing}
                                className={`mt-1.5 h-[34px] ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">
                                תום אחריות מסגרת
                              </Label>
                              <DateInput
                                name="frame_warranty"
                                value={activeFrame.warranty_expiration}
                                onChange={(e) =>
                                  onFrameFieldChange(
                                    "warranty_expiration",
                                    e.target.value,
                                  )
                                }
                                disabled={
                                  !isEditing ||
                                  activeFrame.supplied_by === "לקוח"
                                }
                                className={`mt-1.5 h-[34px] ${isEditing && activeFrame.supplied_by !== "לקוח" ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                          </div>

                          {showAdvancedFrame && (
                            <div className="grid gap-3 pt-2 md:w-1/2 md:grid-cols-4">
                              <div className="max-w-[120px]">
                                <Label className="pb-1.5 text-sm">גשר</Label>
                                <Input
                                  name="bridge"
                                  type="number"
                                  value={activeFrame.bridge || ""}
                                  onChange={(e) =>
                                    onFrameFieldChange("bridge", e.target.value)
                                  }
                                  disabled={!isEditing}
                                  className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                />
                              </div>
                              <div className="max-w-[120px]">
                                <Label className="pb-1.5 text-sm">רוחב</Label>
                                <Input
                                  name="width"
                                  type="number"
                                  value={activeFrame.width || ""}
                                  onChange={(e) =>
                                    onFrameFieldChange("width", e.target.value)
                                  }
                                  disabled={!isEditing}
                                  className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                />
                              </div>
                              <div className="max-w-[120px]">
                                <Label className="pb-1.5 text-sm">גובה</Label>
                                <Input
                                  name="height"
                                  type="number"
                                  value={activeFrame.height || ""}
                                  onChange={(e) =>
                                    onFrameFieldChange("height", e.target.value)
                                  }
                                  disabled={!isEditing}
                                  className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                />
                              </div>
                              <div className="max-w-[120px]">
                                <Label className="pb-1.5 text-sm">
                                  אורך זרוע
                                </Label>
                                <Input
                                  name="length"
                                  type="number"
                                  value={activeFrame.length || ""}
                                  onChange={(e) =>
                                    onFrameFieldChange("length", e.target.value)
                                  }
                                  disabled={!isEditing}
                                  className={`${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="w-full space-y-4">
                <Card className="">
                  <CardContent className="space-y-3 pt-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <Label className="text-sm">סתטוס הזמנה</Label>
                        <Select
                          dir="rtl"
                          disabled={!isEditing}
                          value={orderDetailsFormData.order_status || ""}
                          onValueChange={(value) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              order_status: value,
                            }))
                          }
                        >
                          <SelectTrigger
                            className={`mt-1.5 h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                          >
                            <SelectValue placeholder="בחר סטטוס" />
                          </SelectTrigger>
                          <SelectContent>
                            {ORDER_STATUS_OPTIONS.map((status) => (
                              <SelectItem
                                key={status}
                                value={status}
                                className="text-sm"
                              >
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-1">
                        <Label className="text-sm">עדיפות</Label>
                        <Select
                          dir="rtl"
                          disabled={!isEditing}
                          value={orderDetailsFormData.priority || ""}
                          onValueChange={(value) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              priority: value,
                            }))
                          }
                        >
                          <SelectTrigger
                            className={`mt-1.5 h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                          >
                            <SelectValue placeholder="בחר עדיפות" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="רגיל" className="text-sm">
                              רגיל
                            </SelectItem>
                            <SelectItem value="דחוף" className="text-sm">
                              דחוף
                            </SelectItem>
                            <SelectItem value="מיידי" className="text-sm">
                              מיידי
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-1">
                        <Label className="text-sm">מספר שקית / הזמנה</Label>
                        <div className="flex gap-2">
                          <Input
                            name="bag_number"
                            value={orderDetailsFormData.bag_number || ""}
                            readOnly
                            disabled
                            className={`mt-1.5 h-9 flex-1 ${isEditing ? "bg-white" : "bg-accent/50"} font-mono disabled:cursor-default disabled:opacity-100`}
                          />
                          {clientOrderIndex && (
                            <div
                              className="bg-accent/30 mt-1.5 inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium whitespace-nowrap"
                              title="הזמנה מס' ללקוח זה"
                            >
                              #{clientOrderIndex}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="col-span-1">
                        <Label className="text-sm">נמסר בתאריך</Label>
                        <DateInput
                          name="delivered_at"
                          value={orderDetailsFormData.delivered_at}
                          onChange={(e) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              delivered_at: e.target.value,
                            }))
                          }
                          disabled={!isEditing}
                          className={`mt-1.5 h-9 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <Label className="text-sm">שם המוכר</Label>
                        <LookupSelect
                          value={orderDetailsFormData.advisor || ""}
                          onChange={(value) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              advisor: value,
                            }))
                          }
                          lookupType="advisor"
                          placeholder="שם המוכר..."
                          disabled={!isEditing}
                          className={`mt-1.5 h-9 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                        />
                      </div>

                      <div className="col-span-1">
                        <Label className="text-sm">שם מוסר העבודה</Label>
                        <Select
                          dir="rtl"
                          disabled={!isEditing}
                          value={orderDetailsFormData.delivered_by || ""}
                          onValueChange={(value) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              delivered_by: value,
                            }))
                          }
                        >
                          <SelectTrigger
                            className={`mt-1.5 h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                          >
                            <SelectValue placeholder="בחר מוסר העבודה..." />
                          </SelectTrigger>
                          <SelectContent>
                            {users
                              .filter((u) => u.id)
                              .map((user) => (
                                <SelectItem
                                  key={user.id}
                                  value={user.full_name || user.username}
                                  className="text-sm"
                                >
                                  {user.full_name || user.username}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="col-span-1">
                        <Label className="text-sm">מעבדה מייצרת</Label>
                        <LookupSelect
                          value={orderDetailsFormData.manufacturing_lab || ""}
                          onChange={(value) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              manufacturing_lab: value,
                            }))
                          }
                          lookupType="manufacturingLab"
                          placeholder="בחר או הקלד מעבדה..."
                          disabled={!isEditing}
                          className={`mt-1.5 h-9 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                        />
                      </div>

                      <div className="col-span-1">
                        <Label className="text-sm">אספקה בסניף</Label>
                        <Select
                          dir="rtl"
                          disabled={
                            !isEditing ||
                            isLoadingCompanyClinics ||
                            companyClinics.length === 0
                          }
                          value={
                            orderDetailsFormData.delivery_clinic_id
                              ? String(orderDetailsFormData.delivery_clinic_id)
                              : ""
                          }
                          onValueChange={(value) =>
                            setOrderDetailsFormData((prev) => ({
                              ...prev,
                              delivery_clinic_id: Number(value),
                              delivery_location:
                                companyClinics.find(
                                  (clinic) =>
                                    String(clinic.id) === String(value),
                                )?.name || prev.delivery_location,
                            }))
                          }
                        >
                          <SelectTrigger
                            className={`mt-1.5 h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                          >
                            <SelectValue
                              placeholder={
                                isLoadingCompanyClinics
                                  ? "טוען סניפים..."
                                  : "בחר סניף"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {companyClinics.map((clinic) => (
                              <SelectItem
                                key={clinic.id ?? clinic.name}
                                value={String(clinic.id)}
                                className="text-sm"
                              >
                                {clinic.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <NotesCard
              title="הערות"
              value={orderDetailsFormData.notes || ""}
              onChange={(value) =>
                setOrderDetailsFormData((prev) => ({
                  ...prev,
                  notes: value,
                }))
              }
              disabled={!isEditing}
              placeholder="הערות..."
              className="h-full"
            />
          </div>
          <div className="lg:col-span-1">
            <NotesCard
              title="הערות לספק"
              value={orderDetailsFormData.lens_order_notes || ""}
              onChange={(value) =>
                setOrderDetailsFormData((prev) => ({
                  ...prev,
                  lens_order_notes: value,
                }))
              }
              disabled={!isEditing}
              placeholder="הערות להזמנת עדשות..."
              className="h-full"
            />
          </div>
          <div className="flex flex-col justify-end lg:col-span-1">
            <div className="text-muted-foreground text-left text-xs italic">
              * הזמנה מס' {clientOrderIndex} של הלקוח
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
