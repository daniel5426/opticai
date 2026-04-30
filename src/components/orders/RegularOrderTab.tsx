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
import { OrderFinalPrescriptionTab } from "@/components/orders/OrderFinalPrescriptionTab";
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
import { getAdditionAddTypeOptions } from "@/lib/addition-add-sources";

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

type LensFieldSuffix =
  | "supplier"
  | "material"
  | "model"
  | "coating"
  | "color"
  | "diameter";

type LensSide = "right" | "left";

type LensFieldConfig = {
  key: LensFieldSuffix;
  label: string;
  lookupType?: string;
  placeholder: string;
  inputType?: "number";
  className?: string;
};

const LENS_FIELDS: LensFieldConfig[] = [
  {
    key: "supplier",
    label: "ספק",
    lookupType: "supplier",
    placeholder: "בחר או הקלד ספק...",
  },
  {
    key: "material",
    label: "חומר",
    lookupType: "material",
    placeholder: "בחר או הקלד חומר...",
  },
  {
    key: "model",
    label: "דגם",
    lookupType: "lensModel",
    placeholder: "בחר או הקלד דגם עדשה...",
  },
  {
    key: "coating",
    label: "ציפוי",
    lookupType: "coating",
    placeholder: "בחר או הקלד ציפוי...",
  },
  {
    key: "color",
    label: "צבע",
    lookupType: "color",
    placeholder: "בחר או הקלד צבע...",
  },
  {
    key: "diameter",
    label: "קוטר",
    placeholder: "",
    inputType: "number",
    className: "md:max-w-[120px]",
  },
];

const fieldClass =
  "mt-1.5 h-9 w-full text-sm disabled:cursor-default disabled:opacity-100";
const inlineFieldClass =
  "h-9 w-full text-sm disabled:cursor-default disabled:opacity-100";
const labelClass = "text-sm text-muted-foreground block text-right";
const viewFieldClass =
  "flex h-9 items-center rounded-md border bg-accent/50 px-3 text-sm";
const sectionTitleClass = "text-muted-foreground text-center font-medium";

const getLensFieldName = (
  side: LensSide,
  key: LensFieldSuffix,
): keyof OrderLens => `${side}_${key}` as keyof OrderLens;

const normalizeLensValue = (value: string | undefined) => (value || "").trim();

const lensRowsMatch = (lens: OrderLens) =>
  LENS_FIELDS.every(
    ({ key }) =>
      normalizeLensValue(lens[getLensFieldName("right", key)] as string) ===
      normalizeLensValue(lens[getLensFieldName("left", key)] as string),
  );

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
  const [lensLayoutMode, setLensLayoutMode] = useState<
    "auto" | "combined" | "split"
  >("auto");
  const [lensMergeError, setLensMergeError] = useState("");
  const [companyClinics, setCompanyClinics] = useState<Clinic[]>([]);
  const [isLoadingCompanyClinics, setIsLoadingCompanyClinics] = useState(false);
  const { currentUser, currentClinic } = useUser();
  const activeLens = lensFrameTab?.lens || ({ order_id: 0 } as OrderLens);
  const activeFrame = lensFrameTab?.frame || ({ order_id: 0 } as Frame);
  const addTypeOptions = getAdditionAddTypeOptions(
    finalPrescriptionData.addition_add_sources || {},
  );
  const lensRowsAreEqual = lensRowsMatch(activeLens);
  const isLensSplit =
    lensLayoutMode === "split" ||
    (lensLayoutMode === "auto" && !lensRowsAreEqual);
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

  useEffect(() => {
    setLensLayoutMode("auto");
    setLensMergeError("");
  }, [lensFrameTab?.id]);

  const getLensValue = (side: LensSide, key: LensFieldSuffix) =>
    (activeLens[getLensFieldName(side, key)] as string) || "";

  const updateLensValue = (
    side: LensSide,
    key: LensFieldSuffix,
    value: string,
  ) => {
    onLensFieldChange(getLensFieldName(side, key), value);
  };

  const handleCombinedLensFieldChange = (
    key: LensFieldSuffix,
    value: string,
  ) => {
    setLensMergeError("");
    updateLensValue("right", key, value);
    updateLensValue("left", key, value);
  };

  const handleSplitLensFieldChange = (
    side: LensSide,
    key: LensFieldSuffix,
    value: string,
  ) => {
    setLensMergeError("");
    updateLensValue(side, key, value);

    if (side === "right" && lensRowsAreEqual) {
      updateLensValue("left", key, value);
    }
  };

  const handleLensSplitToggle = () => {
    setLensMergeError("");

    if (isLensSplit) {
      if (!lensRowsAreEqual) {
        setLensMergeError(
          "לא ניתן לאחד כי קיימים הבדלים בין עין ימין לעין שמאל.",
        );
        return;
      }

      setLensLayoutMode("combined");
      return;
    }

    LENS_FIELDS.forEach(({ key }) => {
      updateLensValue("left", key, getLensValue("right", key));
    });
    setLensLayoutMode("split");
  };

  const renderLensRow = ({
    side,
    showEyeLabel,
  }: {
    side: LensSide;
    showEyeLabel: boolean;
  }) => (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_120px] md:items-end">
      {LENS_FIELDS.map((field) => {
        const label = showEyeLabel
          ? `${field.label} ${side === "right" ? "ימין" : "שמאל"}`
          : field.label;

        if (field.inputType === "number") {
          return (
            <div key={`${side}-${field.key}`} className={field.className}>
              <Label className={labelClass}>{label}</Label>
              <Input
                name={getLensFieldName(side, field.key)}
                type="number"
                value={getLensValue(side, field.key)}
                onChange={(e) =>
                  isLensSplit
                    ? handleSplitLensFieldChange(
                        side,
                        field.key,
                        e.target.value,
                      )
                    : handleCombinedLensFieldChange(field.key, e.target.value)
                }
                disabled={!isEditing}
                className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
              />
            </div>
          );
        }

        return (
          <div key={`${side}-${field.key}`}>
            <Label className={labelClass}>{label}</Label>
            <LookupSelect
              value={getLensValue(side, field.key)}
              onChange={(value) =>
                isLensSplit
                  ? handleSplitLensFieldChange(side, field.key, value)
                  : handleCombinedLensFieldChange(field.key, value)
              }
              lookupType={field.lookupType!}
              placeholder={field.placeholder}
              disabled={!isEditing}
              className={`${fieldClass} text-right`}
            />
          </div>
        );
      })}
    </div>
  );

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
                    <h3 className={sectionTitleClass}>פרטי הזמנה</h3>
                  </div>
                  <div
                    className="grid w-full grid-cols-2 items-start gap-x-2 gap-y-5"
                    dir="rtl"
                  >
                    <div className="col-span-1">
                      <label className={labelClass}>תאריך הזמנה</label>
                      <div className="h-1"></div>
                      <DateInput
                        name="order_date"
                        className={`${inlineFieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
                      <label className={labelClass}>סוג הזמנה</label>
                      <div className="h-1"></div>
                      {isEditing ? (
                        <LookupSelect
                          value={formData.type || ""}
                          onChange={(value) =>
                            setFormData((prev) => ({ ...prev, type: value }))
                          }
                          lookupType="orderType"
                          placeholder="סוג הזמנה..."
                          className={`${inlineFieldClass} bg-white text-right`}
                        />
                      ) : (
                        <div className={viewFieldClass}>
                          {formData.type || "לא נבחר"}
                        </div>
                      )}
                    </div>

                    <div className="col-span-1">
                      <label className={labelClass}>עין דומיננטית</label>
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
                          className={`${inlineFieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
                      <label className={labelClass}>בודק</label>
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
                          <SelectTrigger
                            className={`${inlineFieldClass} bg-white text-right`}
                          >
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
                        <div className={viewFieldClass}>
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
            <OrderFinalPrescriptionTab
              finalPrescriptionData={finalPrescriptionData}
              onFinalPrescriptionChange={(field, value) =>
                onFinalPrescriptionChange(
                  field as keyof FinalPrescriptionExam,
                  value,
                )
              }
              isEditing={isEditing}
              hideEyeLabels={false}
              addTypeOptions={addTypeOptions}
            />
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <div className="flex flex-col gap-6">
              <div className="w-full space-y-4">
                <Card className="pt-4">
                  <CardHeader className="px-6 pt-0 pb-3">
                    <div
                      className="flex items-start justify-between gap-3"
                      dir="rtl"
                    >
                      <div>
                        <CardTitle className={sectionTitleClass}>
                          פרטי עדשות
                        </CardTitle>
                      </div>
                      <div className="space-y-1 text-left">
                        <button
                          type="button"
                          onClick={handleLensSplitToggle}
                          className="text-primary border-none bg-transparent pt-1 text-xs outline-none hover:underline"
                        >
                          {isLensSplit
                            ? "אחד לשתי העיניים"
                            : "הפרד בין העיניים"}
                        </button>
                        {lensMergeError ? (
                          <div className="text-xs text-red-600">
                            {lensMergeError}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {renderLensRow({
                      side: "right",
                      showEyeLabel: isLensSplit,
                    })}
                    {isLensSplit
                      ? renderLensRow({
                          side: "left",
                          showEyeLabel: true,
                        })
                      : null}
                  </CardContent>
                </Card>

                <Card className="pt-4">
                  <CardHeader className="px-6 pt-0 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className={sectionTitleClass}>
                          פרטי מסגרת
                        </CardTitle>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedFrame(!showAdvancedFrame)}
                        className="text-primary border-none bg-transparent pt-1 text-xs outline-none hover:underline"
                      >
                        {showAdvancedFrame
                          ? "הסתר שדות מתקדמים"
                          : "הצג שדות מסגרת מתקדמים"}
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label className={labelClass}>שם ספק</Label>
                        <LookupSelect
                          value={activeFrame.supplier || ""}
                          onChange={(value) =>
                            onFrameFieldChange("supplier", value)
                          }
                          lookupType="supplier"
                          placeholder="בחר או הקלד ספק..."
                          disabled={!isEditing}
                          className={`${fieldClass} text-right`}
                        />
                      </div>
                      <div>
                        <Label className={labelClass}>מותג</Label>
                        <LookupSelect
                          value={activeFrame.manufacturer || ""}
                          onChange={(value) =>
                            onFrameFieldChange("manufacturer", value)
                          }
                          lookupType="manufacturer"
                          placeholder="בחר או הקלד מותג..."
                          disabled={!isEditing}
                          className={`${fieldClass} text-right`}
                        />
                      </div>
                      <div>
                        <Label className={labelClass}>דגם</Label>
                        <LookupSelect
                          value={activeFrame.model || ""}
                          onChange={(value) =>
                            onFrameFieldChange("model", value)
                          }
                          lookupType="frameModel"
                          placeholder="בחר או הקלד דגם מסגרת..."
                          disabled={!isEditing}
                          className={`${fieldClass} text-right`}
                        />
                      </div>
                      <div>
                        <Label className={labelClass}>גודל</Label>
                        <Input
                          name="frame_size"
                          type="number"
                          value={activeFrame.width || ""}
                          onChange={(e) =>
                            onFrameFieldChange("width", e.target.value)
                          }
                          disabled={!isEditing}
                          className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <Label className={labelClass}>צבע</Label>
                        <LookupSelect
                          value={activeFrame.color || ""}
                          onChange={(value) =>
                            onFrameFieldChange("color", value)
                          }
                          lookupType="color"
                          placeholder="בחר או הקלד צבע..."
                          disabled={!isEditing}
                          className={`${fieldClass} text-right`}
                        />
                      </div>
                      <div>
                        <Label className={labelClass}>סופק על ידי</Label>
                        <Select
                          dir="rtl"
                          disabled={!isEditing}
                          value={activeFrame.supplied_by || "חנות"}
                          onValueChange={(value) =>
                            onFrameFieldChange("supplied_by", value)
                          }
                        >
                          <SelectTrigger
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
                        <Label className={labelClass}>תום אחריות עדשות</Label>
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
                          className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                        />
                      </div>
                      <div>
                        <Label className={labelClass}>תום אחריות מסגרת</Label>
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
                            !isEditing || activeFrame.supplied_by === "לקוח"
                          }
                          className={`${fieldClass} ${isEditing && activeFrame.supplied_by !== "לקוח" ? "bg-white" : "bg-accent/50"}`}
                        />
                      </div>
                    </div>

                    {showAdvancedFrame && (
                      <div className="grid gap-3 pt-2 md:w-1/2 md:grid-cols-4">
                        <div className="max-w-[120px]">
                          <Label className={labelClass}>גשר</Label>
                          <Input
                            name="bridge"
                            type="number"
                            value={activeFrame.bridge || ""}
                            onChange={(e) =>
                              onFrameFieldChange("bridge", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                          />
                        </div>
                        <div className="max-w-[120px]">
                          <Label className={labelClass}>רוחב</Label>
                          <Input
                            name="width"
                            type="number"
                            value={activeFrame.width || ""}
                            onChange={(e) =>
                              onFrameFieldChange("width", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                          />
                        </div>
                        <div className="max-w-[120px]">
                          <Label className={labelClass}>גובה</Label>
                          <Input
                            name="height"
                            type="number"
                            value={activeFrame.height || ""}
                            onChange={(e) =>
                              onFrameFieldChange("height", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                          />
                        </div>
                        <div className="max-w-[120px]">
                          <Label className={labelClass}>אורך זרוע</Label>
                          <Input
                            name="length"
                            type="number"
                            value={activeFrame.length || ""}
                            onChange={(e) =>
                              onFrameFieldChange("length", e.target.value)
                            }
                            disabled={!isEditing}
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="w-full space-y-4">
                <Card className="">
                  <CardContent className="space-y-3 pt-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <Label className={labelClass}>סתטוס הזמנה</Label>
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
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
                        <Label className={labelClass}>עדיפות</Label>
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
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
                        <Label className={labelClass}>מספר שקית / הזמנה</Label>
                        <div className="flex gap-2">
                          <Input
                            name="bag_number"
                            value={orderDetailsFormData.bag_number || ""}
                            readOnly
                            disabled
                            className={`${fieldClass} flex-1 ${isEditing ? "bg-white" : "bg-accent/50"} font-mono`}
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
                        <Label className={labelClass}>נמסר בתאריך</Label>
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
                          className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-1">
                        <Label className={labelClass}>שם המוכר</Label>
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
                          className={`${fieldClass} text-right ${isEditing ? "bg-white" : "bg-accent/50"}`}
                        />
                      </div>

                      <div className="col-span-1">
                        <Label className={labelClass}>שם מוסר העבודה</Label>
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
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
                        <Label className={labelClass}>מעבדה מייצרת</Label>
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
                          className={`${fieldClass} text-right ${isEditing ? "bg-white" : "bg-accent/50"}`}
                        />
                      </div>

                      <div className="col-span-1">
                        <Label className={labelClass}>אספקה בסניף</Label>
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
                            className={`${fieldClass} ${isEditing ? "bg-white" : "bg-accent/50"}`}
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
