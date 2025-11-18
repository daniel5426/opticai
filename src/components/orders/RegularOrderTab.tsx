import React from "react";
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
import { UserSelect } from "@/components/ui/user-select";
import { DateInput } from "@/components/ui/date";
import { ExamToolbox } from "@/components/exam/ExamToolbox";
import { FinalPrescriptionTab } from "@/components/exam/FinalPrescriptionTab";
import { NotesCard } from "@/components/ui/notes-card";
import { Order, FinalPrescriptionExam, User } from "@/lib/db/schema-interface";

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

type OrderDetails = {
  order_id: number;
  branch?: string;
  supplier_status?: string;
  bag_number?: string;
  advisor?: string;
  delivered_by?: string;
  technician?: string;
  delivered_at?: string;
  warranty_expiration?: string;
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
  lensFormData: OrderLens;
  setLensFormData: React.Dispatch<React.SetStateAction<OrderLens>>;
  frameFormData: Frame;
  setFrameFormData: React.Dispatch<React.SetStateAction<Frame>>;
  onFrameSelectChange: (value: string, name: string) => void;
  onFrameInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  lensFormData,
  setLensFormData,
  frameFormData,
  setFrameFormData,
  onFrameSelectChange,
  onFrameInputChange,
  orderDetailsFormData,
  setOrderDetailsFormData,
}: RegularOrderTabProps) {
  return (
    <form
      ref={formRef}
      className="no-scrollbar pt-4 pb-10"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="grid grid-cols-1 gap-4">
        <Card className="w-full p-4">
          <div className="grid w-full grid-cols-4 gap-x-3 gap-y-2" dir="rtl">
            <div className="col-span-1">
              <label className="text-base font-semibold">תאריך הזמנה</label>
              <div className="h-1"></div>
              <DateInput
                name="order_date"
                className={`h-9 px-14 ${isEditing ? "bg-white" : "bg-accent/50"}`}
                value={formData.order_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, order_date: e.target.value }))
                }
                disabled={!isEditing}
              />
            </div>

            <div className="col-span-1">
              <label className="text-base font-semibold">סוג הזמנה</label>
              <div className="h-1"></div>
              {isEditing ? (
                <LookupSelect
                  value={formData.type || ""}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, type: value }))
                  }
                  lookupType="orderType"
                  placeholder="בחר או הקלד סוג הזמנה..."
                  className="h-9 bg-white"
                />
              ) : (
                <div className="bg-accent/50 flex h-9 items-center rounded-md border px-3 text-sm">
                  {formData.type || "לא נבחר"}
                </div>
              )}
            </div>

            <div className="col-span-1">
              <label className="text-base font-semibold">עין דומיננטית</label>
              <div className="h-1"></div>
              <Select
                dir="rtl"
                disabled={!isEditing}
                value={formData.dominant_eye || ""}
                onValueChange={(value) => onSelectChange(value, "dominant_eye")}
              >
                <SelectTrigger className={`h-9 w-full text-sm ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}>
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
              <label className="text-base font-semibold">בודק</label>
              <div className="h-1"></div>
              {isEditing ? (
                <UserSelect
                  value={formData.user_id}
                  onValueChange={(userId) =>
                    setFormData((prev) => ({ ...prev, user_id: userId }))
                  }
                />
              ) : (
                <div className="bg-accent/50 flex h-9 items-center rounded-md border px-3 text-sm">
                  {formData.user_id
                    ? users.find((u) => u.id === formData.user_id)?.full_name ||
                      users.find((u) => u.id === formData.user_id)?.username ||
                      "משתמש לא נמצא"
                    : "לא נבחר בודק"}
                </div>
              )}
            </div>
          </div>
        </Card>

        <div className="relative h-full">
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
              onFinalPrescriptionChange(field as keyof FinalPrescriptionExam, value)
            }
            isEditing={isEditing}
            hideEyeLabels={false}
          />
        </div>

        <div className="flex gap-6">
          <div className="flex-1">
            <Tabs defaultValue="prescription" className="w-full" dir="rtl" orientation="vertical">
              <div className="flex gap-6">
                <TabsList className="dark:bg-card/50 flex h-fit w-28 flex-col bg-cyan-800/10 p-1">
                  <TabsTrigger value="prescription" className="w-full justify-end text-right">
                    <div className="w-full text-right">
                      <div className="flex items-center justify-start gap-1">
                        <span className="font-medium">מרשם</span>
                      </div>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="order" className="w-full justify-end text-right">
                    <div className="w-full text-right">
                      <div className="flex items-center justify-start gap-1">
                        <span className="font-medium">הזמנה</span>
                      </div>
                    </div>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="w-full justify-end text-right">
                    <div className="w-full text-right">
                      <div className="flex items-center justify-start gap-1">
                        <span className="font-medium">הערות</span>
                      </div>
                    </div>
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1">
                  <TabsContent value="prescription" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <Card className="">
                        <CardHeader>
                          <CardTitle className="text-base">פרטי עדשות</CardTitle>
                          <p className="text-muted-foreground text-sm">מידע על סוג העדשות, צבע, ציפוי וחומר</p>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">דגם עדשה ימין</Label>
                            <LookupSelect
                              value={lensFormData.right_model || ""}
                              onChange={(value) =>
                                setLensFormData((prev) => ({ ...prev, right_model: value }))
                              }
                              lookupType="lensModel"
                              placeholder="בחר או הקלד דגם עדשה..."
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">דגם עדשה שמאל</Label>
                            <LookupSelect
                              value={lensFormData.left_model || ""}
                              onChange={(value) =>
                                setLensFormData((prev) => ({ ...prev, left_model: value }))
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
                              value={lensFormData.color || ""}
                              onChange={(value) =>
                                setLensFormData((prev) => ({ ...prev, color: value }))
                              }
                              lookupType="color"
                              placeholder="בחר או הקלד צבע..."
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">ציפוי</Label>
                            <LookupSelect
                              value={lensFormData.coating || ""}
                              onChange={(value) =>
                                setLensFormData((prev) => ({ ...prev, coating: value }))
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
                              value={lensFormData.material || ""}
                              onChange={(value) =>
                                setLensFormData((prev) => ({ ...prev, material: value }))
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
                              value={lensFormData.supplier || ""}
                              onChange={(value) =>
                                setLensFormData((prev) => ({ ...prev, supplier: value }))
                              }
                              lookupType="supplier"
                              placeholder="בחר או הקלד ספק..."
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="">
                        <CardHeader>
                          <CardTitle className="text-base">פרטי מסגרת</CardTitle>
                          <p className="text-muted-foreground text-sm">מידע על יצרן, דגם, מידות וספק המסגרת</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">יצרן</Label>
                              <LookupSelect
                                value={frameFormData.manufacturer || ""}
                                onChange={(value) =>
                                  setFrameFormData((prev) => ({ ...prev, manufacturer: value }))
                                }
                                lookupType="manufacturer"
                                placeholder="בחר או הקלד יצרן..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">דגם</Label>
                              <LookupSelect
                                value={frameFormData.model || ""}
                                onChange={(value) =>
                                  setFrameFormData((prev) => ({ ...prev, model: value }))
                                }
                                lookupType="frameModel"
                                placeholder="בחר או הקלד דגם מסגרת..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-sm">צבע</Label>
                              <LookupSelect
                                value={frameFormData.color || ""}
                                onChange={(value) =>
                                  setFrameFormData((prev) => ({ ...prev, color: value }))
                                }
                                lookupType="color"
                                placeholder="בחר או הקלד צבע..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">ספק</Label>
                              <LookupSelect
                                value={frameFormData.supplier || ""}
                                onChange={(value) =>
                                  setFrameFormData((prev) => ({ ...prev, supplier: value }))
                                }
                                lookupType="supplier"
                                placeholder="בחר או הקלד ספק..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-5 gap-3">
                            <div>
                              <Label className="text-sm">סופק על ידי</Label>
                              <Select
                                dir="rtl"
                                disabled={!isEditing}
                                value={frameFormData.supplied_by || ""}
                                onValueChange={(value) => onFrameSelectChange(value, "supplied_by")}
                              >
                                <SelectTrigger className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}>
                                  <SelectValue placeholder="בחר" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="חנות" className="text-sm">חנות</SelectItem>
                                  <SelectItem value="לקוח" className="text-sm">לקוח</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">גשר</Label>
                              <Input
                                name="bridge"
                                type="number"
                                value={frameFormData.bridge || ""}
                                onChange={onFrameInputChange}
                                disabled={!isEditing}
                                className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">רוחב</Label>
                              <Input
                                name="width"
                                type="number"
                                value={frameFormData.width || ""}
                                onChange={onFrameInputChange}
                                disabled={!isEditing}
                                className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">גובה</Label>
                              <Input
                                name="height"
                                type="number"
                                value={frameFormData.height || ""}
                                onChange={onFrameInputChange}
                                disabled={!isEditing}
                                className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">אורך זרוע</Label>
                              <Input
                                name="length"
                                type="number"
                                value={frameFormData.length || ""}
                                onChange={onFrameInputChange}
                                disabled={!isEditing}
                                className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="order" className="mt-0 space-y-4">
                    <Card className="">
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-5 gap-3">
                          <div>
                            <Label className="text-sm">סניף</Label>
                            <LookupSelect
                              value={orderDetailsFormData.branch || ""}
                              onChange={(value) =>
                                setOrderDetailsFormData((prev) => ({ ...prev, branch: value }))
                              }
                              lookupType="clinic"
                              placeholder="בחר או הקלד סניף..."
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">סטטוס ספק</Label>
                            <Input
                              name="supplier_status"
                              value={orderDetailsFormData.supplier_status || ""}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({ ...prev, supplier_status: e.target.value }))
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
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({ ...prev, bag_number: e.target.value }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">יועץ</Label>
                            <LookupSelect
                              value={orderDetailsFormData.advisor || ""}
                              onChange={(value) =>
                                setOrderDetailsFormData((prev) => ({ ...prev, advisor: value }))
                              }
                              lookupType="advisor"
                              placeholder="בחר או הקלד יועץ..."
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
                                setOrderDetailsFormData((prev) => ({ ...prev, delivered_by: e.target.value }))
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
                                setOrderDetailsFormData((prev) => ({ ...prev, technician: e.target.value }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">אספקה בסניף</Label>
                            <Input
                              name="delivery_location"
                              value={orderDetailsFormData.delivery_location || ""}
                              onChange={(e) =>
                                setOrderDetailsFormData((prev) => ({ ...prev, delivery_location: e.target.value }))
                              }
                              disabled={!isEditing}
                              className={`mt-1.5 ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}
                            />
                          </div>
                          <div>
                            <Label className="text-sm">מעבדה מייצרת</Label>
                            <LookupSelect
                              value={orderDetailsFormData.manufacturing_lab || ""}
                              onChange={(value) =>
                                setOrderDetailsFormData((prev) => ({ ...prev, manufacturing_lab: value }))
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
                                setOrderDetailsFormData((prev) => ({ ...prev, order_status: value }))
                              }
                            >
                              <SelectTrigger className={`mt-1.5 h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}>
                                <SelectValue placeholder="בחר סטטוס" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="חדש" className="text-sm">חדש</SelectItem>
                                <SelectItem value="בייצור" className="text-sm">בייצור</SelectItem>
                                <SelectItem value="מוכן" className="text-sm">מוכן</SelectItem>
                                <SelectItem value="נמסר" className="text-sm">נמסר</SelectItem>
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
                                setOrderDetailsFormData((prev) => ({ ...prev, priority: value }))
                              }
                            >
                              <SelectTrigger className={`mt-1.5 h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"} disabled:cursor-default disabled:opacity-100`}>
                                <SelectValue placeholder="בחר עדיפות" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="רגיל" className="text-sm">רגיל</SelectItem>
                                <SelectItem value="דחוף" className="text-sm">דחוף</SelectItem>
                                <SelectItem value="מיידי" className="text-sm">מיידי</SelectItem>
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
                                setOrderDetailsFormData((prev) => ({ ...prev, delivered_at: e.target.value }))
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
                                setOrderDetailsFormData((prev) => ({ ...prev, promised_date: e.target.value }))
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
                                setOrderDetailsFormData((prev) => ({ ...prev, approval_date: e.target.value }))
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

                  <TabsContent value="notes" className="mt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <NotesCard
                        title="הערות"
                        value={orderDetailsFormData.notes || ""}
                        onChange={(value) =>
                          setOrderDetailsFormData((prev) => ({ ...prev, notes: value }))
                        }
                        disabled={!isEditing}
                        placeholder="הערות..."
                      />
                      <NotesCard
                        title="הערות לספק"
                        value={orderDetailsFormData.lens_order_notes || ""}
                        onChange={(value) =>
                          setOrderDetailsFormData((prev) => ({ ...prev, lens_order_notes: value }))
                        }
                        disabled={!isEditing}
                        placeholder="הערות להזמנת עדשות..."
                      />
                    </div>
                  </TabsContent>
                </div>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </form>
  );
}


