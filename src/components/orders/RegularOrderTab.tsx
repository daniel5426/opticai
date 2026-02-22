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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { apiClient } from "@/lib/api-client";
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status";

type OrderLens = {
  order_id: number;
  right_model?: string;
  left_model?: string;
  color?: string;
  coating?: string;
  material?: string;
  supplier?: string;
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
  lensFrameTabs: LensFrameTab[];
  activeLensFrameTab: number;
  onLensFrameTabChange: (tabIdx: number) => void;
  onAddLensFrameTab: (type: string) => void;
  onDeleteLensFrameTab: (tabIdx: number) => void;
  onDuplicateLensFrameTab: (tabIdx: number) => void;
  onUpdateLensFrameTabType: (tabIdx: number, newType: string) => void;
  onLensFieldChange: (
    tabIdx: number,
    field: keyof OrderLens,
    value: string,
  ) => void;
  onFrameFieldChange: (
    tabIdx: number,
    field: keyof Frame,
    value: string,
  ) => void;
  orderDetailsFormData: OrderDetails;
  setOrderDetailsFormData: React.Dispatch<React.SetStateAction<OrderDetails>>;
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
  lensFrameTabs,
  activeLensFrameTab,
  onLensFrameTabChange,
  onAddLensFrameTab,
  onDeleteLensFrameTab,
  onDuplicateLensFrameTab,
  onUpdateLensFrameTabType,
  onLensFieldChange,
  onFrameFieldChange,
  orderDetailsFormData,
  setOrderDetailsFormData,
}: RegularOrderTabProps) {
  const [dropdownTabIdx, setDropdownTabIdx] = useState<number | null>(null);
  const [companyClinics, setCompanyClinics] = useState<Clinic[]>([]);
  const [isLoadingCompanyClinics, setIsLoadingCompanyClinics] = useState(false);
  const { currentUser, currentClinic } = useUser();
  const glassesTypeOptions = ["רחוק", "קרוב", "מולטיפוקל", "ביפוקל"];
  const tabCount = lensFrameTabs.length;
  const activeTabData = lensFrameTabs[activeLensFrameTab];
  const activeLens = activeTabData?.lens || ({ order_id: 0 } as OrderLens);
  const activeFrame = activeTabData?.frame || ({ order_id: 0 } as Frame);
  const effectiveCompanyId = currentUser?.company_id ?? currentClinic?.company_id;

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
        const response = await apiClient.getClinicsByCompany(effectiveCompanyId);
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

  const handleTabClick = (idx: number) => {
    onLensFrameTabChange(idx);
    setDropdownTabIdx(null);
  };

  const handleTabContextMenu = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (isEditing) {
      setDropdownTabIdx(idx);
    }
  };

  return (
    <form
      ref={formRef}
      className="no-scrollbar pt-4 pb-10"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="grid grid-cols-1 gap-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4" dir="rtl">
          <div className="lg:col-span-1">
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
                          placeholder="בחר או הקלד סוג הזמנה..."
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
                onCopyLeft={() => { }}
                onCopyRight={() => { }}
                onCopyBelow={() => { }}
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
            <Tabs
              defaultValue="prescription"
              className="w-full"
              dir="rtl"
              orientation="vertical"
            >
              <div className="flex gap-6">
                <TabsList className="dark:bg-card/50 flex h-fit w-28 flex-col bg-cyan-800/10 p-1">
                  <TabsTrigger
                    value="prescription"
                    className="w-full justify-end text-right"
                  >
                    <div className="w-full text-right">
                      <div className="flex items-center justify-start gap-1">
                        <span className="font-medium">מרשם</span>
                      </div>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger
                    value="order"
                    className="w-full justify-end text-right"
                  >
                    <div className="w-full text-right">
                      <div className="flex items-center justify-start gap-1">
                        <span className="font-medium">הזמנה</span>
                      </div>
                    </div>
                  </TabsTrigger>

                </TabsList>

                <div className="flex-1">
                  <TabsContent value="prescription" className="mt-0 space-y-4">
                    <Card className="pt-4">
                      <CardContent className="space-y-4 ">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-6">
                          <div>
                            <CardHeader className="px-0 pt-0 pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <CardTitle className="text-base">
                                    פרטי עדשות
                                  </CardTitle>
                                  <p className="text-muted-foreground text-sm">
                                    מידע על מותג, דגם, צבע ורוחב העדשה
                                  </p>
                                </div>
                              </div>
                            </CardHeader>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm">שם מותג</Label>
                                  <LookupSelect
                                    value={activeLens.supplier || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "supplier",
                                        value,
                                      )
                                    }
                                    lookupType="supplier"
                                    placeholder="בחר או הקלד שם מותג..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">דגם</Label>
                                  <LookupSelect
                                    value={activeLens.right_model || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "right_model",
                                        value,
                                      )
                                    }
                                    lookupType="lensModel"
                                    placeholder="בחר או הקלד דגם עדשה..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">צבע</Label>
                                  <LookupSelect
                                    value={activeLens.color || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "color",
                                        value,
                                      )
                                    }
                                    lookupType="color"
                                    placeholder="בחר או הקלד צבע..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">רוחב</Label>
                                  <Input
                                    name="lens_width"
                                    type="text"
                                    value={activeLens.material || ""}
                                    onChange={(e) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "material",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!isEditing}
                                    className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                  />
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm">דגם עדשה שמאל</Label>
                                  <LookupSelect
                                    value={activeLens.left_model || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "left_model",
                                        value,
                                      )
                                    }
                                    lookupType="lensModel"
                                    placeholder="בחר או הקלד דגם עדשה..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">ציפוי</Label>
                                  <LookupSelect
                                    value={activeLens.coating || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "coating",
                                        value,
                                      )
                                    }
                                    lookupType="coating"
                                    placeholder="בחר או הקלד ציפוי..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">חומר</Label>
                                  <LookupSelect
                                    value={activeLens.material || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "material",
                                        value,
                                      )
                                    }
                                    lookupType="material"
                                    placeholder="בחר או הקלד חומר..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">ספק</Label>
                                  <LookupSelect
                                    value={activeLens.supplier || ""}
                                    onChange={(value) =>
                                      onLensFieldChange(
                                        activeLensFrameTab,
                                        "supplier",
                                        value,
                                      )
                                    }
                                    lookupType="supplier"
                                    placeholder="בחר או הקלד ספק..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-border w-px self-stretch" />

                          <div>
                            <CardHeader className="px-0 pt-0 pb-3">
                              <div className="flex items-start justify-between gap-3">

                                <div>
                                  <CardTitle className="text-base">
                                    פרטי מסגרת
                                  </CardTitle>
                                  <p className="text-muted-foreground text-sm">
                                    מידע על ספק, מותג, דגם, גודל וצבע המסגרת
                                  </p>
                                </div>
                                <div
                                  className="bg-accent flex items-center justify-start gap-0 rounded-md pr-1"
                                  style={{ direction: "rtl" }}
                                >
                                  {Array.from({ length: tabCount })
                                    .map((_, idx) => tabCount - 1 - idx)
                                    .map((revIdx) => {
                                      const tabData = lensFrameTabs[revIdx];
                                      const currentType = tabData?.type;
                                      const typeLabel =
                                        currentType || (revIdx + 1).toString();
                                      const otherTypes =
                                        glassesTypeOptions.filter(
                                          (t) => t !== currentType,
                                        );

                                      return (
                                        <DropdownMenu
                                          key={tabData?.id || revIdx}
                                          open={dropdownTabIdx === revIdx}
                                          onOpenChange={(open) => {
                                            if (!open) setDropdownTabIdx(null);
                                          }}
                                          dir="rtl"
                                          modal={false}
                                        >
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              type="button"
                                              className={`rounded border-none px-2 text-xs font-bold transition-all duration-150 ${activeLensFrameTab === revIdx ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-accent bg-transparent"}`}
                                              onClick={() =>
                                                handleTabClick(revIdx)
                                              }
                                              onContextMenu={(e) =>
                                                handleTabContextMenu(revIdx, e)
                                              }
                                              style={{ outline: "none" }}
                                            >
                                              {typeLabel}
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent
                                            align="center"
                                            sideOffset={4}
                                            style={{ zIndex: 1000 }}
                                          >
                                            <DropdownMenuItem
                                              onClick={() => {
                                                if (isEditing && tabCount > 1) {
                                                  onDeleteLensFrameTab(revIdx);
                                                  setDropdownTabIdx(null);
                                                }
                                              }}
                                              className={`text-destructive ${tabCount <= 1 || !isEditing ? "pointer-events-none opacity-50" : ""}`}
                                              disabled={
                                                tabCount <= 1 || !isEditing
                                              }
                                            >
                                              מחק
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => {
                                                if (isEditing) {
                                                  onDuplicateLensFrameTab(
                                                    revIdx,
                                                  );
                                                  setDropdownTabIdx(null);
                                                }
                                              }}
                                              disabled={!isEditing}
                                            >
                                              שכפל
                                            </DropdownMenuItem>
                                            {otherTypes.length > 0 &&
                                              isEditing && (
                                                <>
                                                  <div className="bg-muted my-1 h-px" />
                                                  <div className="text-muted-foreground px-2 py-1 text-right text-[10px] font-medium">
                                                    שנה סוג ל:
                                                  </div>
                                                  {otherTypes.map((type) => (
                                                    <DropdownMenuItem
                                                      key={type}
                                                      onClick={() => {
                                                        onUpdateLensFrameTabType(
                                                          revIdx,
                                                          type,
                                                        );
                                                        setDropdownTabIdx(null);
                                                      }}
                                                    >
                                                      {type}
                                                    </DropdownMenuItem>
                                                  ))}
                                                </>
                                              )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      );
                                    })}
                                  <DropdownMenu dir="rtl" modal={false}>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="hover:bg-accent flex items-center justify-center rounded-full border-none bg-transparent p-1"
                                        disabled={!isEditing || tabCount >= 4}
                                        style={{
                                          outline: "none",
                                          opacity:
                                            isEditing && tabCount < 4 ? 1 : 0.5,
                                          pointerEvents:
                                            isEditing && tabCount < 4
                                              ? "auto"
                                              : "none",
                                          transition: "opacity 0.2s",
                                        }}
                                        title="הוסף טאב"
                                      >
                                        <Plus size={16} />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="center"
                                      sideOffset={4}
                                      style={{ zIndex: 1000 }}
                                    >
                                      <div className="text-muted-foreground px-2 py-1 text-right text-[10px] font-medium">
                                        בחר סוג זוג:
                                      </div>
                                      {glassesTypeOptions.map((type) => (
                                        <DropdownMenuItem
                                          key={type}
                                          onClick={() =>
                                            onAddLensFrameTab(type)
                                          }
                                        >
                                          {type}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </CardHeader>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm">שם ספק</Label>
                                  <LookupSelect
                                    value={activeFrame.supplier || ""}
                                    onChange={(value) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "supplier",
                                        value,
                                      )
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
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "manufacturer",
                                        value,
                                      )
                                    }
                                    lookupType="manufacturer"
                                    placeholder="בחר או הקלד מותג..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm">דגם</Label>
                                  <LookupSelect
                                    value={activeFrame.model || ""}
                                    onChange={(value) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "model",
                                        value,
                                      )
                                    }
                                    lookupType="frameModel"
                                    placeholder="בחר או הקלד דגם מסגרת..."
                                    disabled={!isEditing}
                                    className="mt-1.5"
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">גודל</Label>
                                  <Input
                                    name="frame_size"
                                    type="number"
                                    value={activeFrame.width || ""}
                                    onChange={(e) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "width",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!isEditing}
                                    className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <Label className="text-sm">צבע</Label>
                                  <LookupSelect
                                    value={activeFrame.color || ""}
                                    onChange={(value) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "color",
                                        value,
                                      )
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
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "supplied_by",
                                        value,
                                      )
                                    }
                                  >
                                    <SelectTrigger
                                      className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                    >
                                      <SelectValue placeholder="בחר" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem
                                        value="חנות"
                                        className="text-sm"
                                      >
                                        חנות
                                      </SelectItem>
                                      <SelectItem
                                        value="לקוח"
                                        className="text-sm"
                                      >
                                        לקוח
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-4 gap-3">
                                <div>
                                  <Label className="text-sm">גשר</Label>
                                  <Input
                                    name="bridge"
                                    type="number"
                                    value={activeFrame.bridge || ""}
                                    onChange={(e) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "bridge",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!isEditing}
                                    className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">רוחב</Label>
                                  <Input
                                    name="width"
                                    type="number"
                                    value={activeFrame.width || ""}
                                    onChange={(e) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "width",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!isEditing}
                                    className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">גובה</Label>
                                  <Input
                                    name="height"
                                    type="number"
                                    value={activeFrame.height || ""}
                                    onChange={(e) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "height",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!isEditing}
                                    className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">אורך זרוע</Label>
                                  <Input
                                    name="length"
                                    type="number"
                                    value={activeFrame.length || ""}
                                    onChange={(e) =>
                                      onFrameFieldChange(
                                        activeLensFrameTab,
                                        "length",
                                        e.target.value,
                                      )
                                    }
                                    disabled={!isEditing}
                                    className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="order" className="mt-0 space-y-4">
                    <Card className="">
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-4 gap-3">
                          <div>
                            <Label className="text-sm">סטטוס ספק</Label>
                            <Input
                              name="supplier_status"
                              value={orderDetailsFormData.supplier_status || ""}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  supplier_status: e.target.value,
                                }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">מספר שקית</Label>
                            <Input
                              name="bag_number"
                              value={orderDetailsFormData.bag_number || ""}
                              readOnly
                              disabled
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
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
                              placeholder="בחר או הקלד שם המוכר..."
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">מוסר</Label>
                            <Input
                              name="delivered_by"
                              value={orderDetailsFormData.delivered_by || ""}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  delivered_by: e.target.value,
                                }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                          <div>
                            <Label className="text-sm">טכני</Label>
                            <Input
                              name="technician"
                              value={orderDetailsFormData.technician || ""}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  technician: e.target.value,
                                }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
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
                                  ? String(
                                      orderDetailsFormData.delivery_clinic_id,
                                    )
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
                                {orderDetailsFormData.delivery_clinic_id &&
                                  !companyClinics.some(
                                    (clinic) =>
                                      clinic.id ===
                                      orderDetailsFormData.delivery_clinic_id,
                                  ) && (
                                    <SelectItem
                                      value={String(
                                        orderDetailsFormData.delivery_clinic_id,
                                      )}
                                      className="text-sm"
                                    >
                                      {orderDetailsFormData.delivery_location ||
                                        `סניף #${orderDetailsFormData.delivery_clinic_id}`}
                                    </SelectItem>
                                  )}
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
                          <div>
                            <Label className="text-sm">מעבדה מייצרת</Label>
                            <LookupSelect
                              value={
                                orderDetailsFormData.manufacturing_lab || ""
                              }
                              onChange={(value) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  manufacturing_lab: value,
                                }))
                              }
                              lookupType="manufacturingLab"
                              placeholder="בחר או הקלד מעבדה..."
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">סטטוס הזמנה</Label>
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
                          <div>
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
                        </div>

                        <div className="grid grid-cols-5 gap-3">
                          <div>
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
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">תאריך תום אחריות</Label>
                            <DateInput
                              name="warranty_expiration"
                              value={orderDetailsFormData.warranty_expiration}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  warranty_expiration: e.target.value,
                                }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">הובטח לתאריך</Label>
                            <DateInput
                              name="promised_date"
                              value={orderDetailsFormData.promised_date}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  promised_date: e.target.value,
                                }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">תאריך אישור</Label>
                            <DateInput
                              name="approval_date"
                              value={orderDetailsFormData.approval_date}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({
                                  ...prev,
                                  approval_date: e.target.value,
                                }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div></div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>


                </div>
              </div>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
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
          />
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
          />
        </div>
      </div>
    </form>
  );
}
