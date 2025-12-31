import React from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupSelect } from "@/components/ui/lookup-select";
import { UserSelect } from "@/components/ui/user-select";
import { DateInput } from "@/components/ui/date";
import { NotesCard } from "@/components/ui/notes-card";
import { ContactLensDetailsTab } from "@/components/exam/ContactLensDetailsTab";
import { ContactLensExamTab } from "@/components/exam/ContactLensExamTab";
import { KeratometerContactLensTab } from "@/components/exam/KeratometerContactLensTab";
import { SchirmerTestTab } from "@/components/exam/SchirmerTestTab";
import { ContactLensDiametersTab } from "@/components/exam/ContactLensDiametersTab";
import { ContactLensOrderTab } from "@/components/exam/ContactLensOrderTab";
import { User } from "@/lib/db/schema-interface";

interface ContactOrderTabProps {
  formRef: React.RefObject<HTMLFormElement | null>;
  isEditing: boolean;
  users: User[];
  contactFormData: any;
  setContactFormData: React.Dispatch<React.SetStateAction<any>>;
  contactLensDetailsData: any;
  setContactLensDetailsData: React.Dispatch<React.SetStateAction<any>>;
  contactLensExamData: any;
  setContactLensExamData: React.Dispatch<React.SetStateAction<any>>;
  keratoCLData: any;
  setKeratoCLData: React.Dispatch<React.SetStateAction<any>>;
  schirmerData: any;
  setSchirmerData: React.Dispatch<React.SetStateAction<any>>;
  diametersData: any;
  setDiametersData: React.Dispatch<React.SetStateAction<any>>;
}

export default function ContactOrderTab({
  formRef,
  isEditing,
  users,
  contactFormData,
  setContactFormData,
  contactLensDetailsData,
  setContactLensDetailsData,
  contactLensExamData,
  setContactLensExamData,
  keratoCLData,
  setKeratoCLData,
  schirmerData,
  setSchirmerData,
  diametersData,
  setDiametersData,
}: ContactOrderTabProps) {
  return (
    <form
      ref={formRef}
      className="no-scrollbar pt-4 pb-10"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div className="grid grid-cols-1 gap-4">
        {/* Two-column layout for the top section */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" dir="rtl">
          <div className="lg:col-span-1">
            <Card className="w-full h-full p-4 gap-2 shadow-md">
              <CardHeader>
                <CardTitle className="text-base text-semibold text-center">פרטי הזמנה</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-4 pt-0" dir="rtl">
                <div>
                  <label className="text-md text-semibold text-muted-foreground">תאריך הזמנה</label>
                  <div className="h-1"></div>
                  <DateInput
                    name="order_date"
                    className={`h-9 w-full ${isEditing ? "bg-white" : "bg-accent/50"}`}
                    value={contactFormData.order_date}
                    onChange={(e) =>
                      setContactFormData((prev: any) => ({ ...prev, order_date: e.target.value }))
                    }
                    disabled={!isEditing}
                  />
                </div>
                <div>
                  <label className="text-md text-semibold  text-muted-foreground">סוג הזמנה</label>
                  <div className="h-1"></div>
                  {isEditing ? (
                    <LookupSelect
                      value={contactFormData.type || ""}
                      onChange={(value) =>
                        setContactFormData((prev: any) => ({ ...prev, type: value }))
                      }
                      lookupType="orderType"
                      placeholder="בחר או הקלד סוג הזמנה..."
                      className="h-9 bg-white"
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-9 items-center rounded-md border px-3 text-sm">
                      {contactFormData.type || "לא נבחר"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-md text-semibold text-muted-foreground">בודק</label>
                  <div className="h-1"></div>
                  {isEditing ? (
                    <UserSelect
                      value={contactFormData.user_id}
                      onValueChange={(userId) =>
                        setContactFormData((prev: any) => ({ ...prev, user_id: userId }))
                      }
                    />
                  ) : (
                    <div className="bg-accent/50 flex h-9 items-center rounded-md border px-3 text-sm">
                      {contactFormData.user_id
                        ? users.find((u) => u.id === contactFormData.user_id)?.full_name ||
                        users.find((u) => u.id === contactFormData.user_id)?.username ||
                        "משתמש לא נמצא"
                        : "לא נבחר בודק"}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-md text-semibold text-muted-foreground">עין דומיננטית</label>
                  <div className="h-1"></div>
                  <Select
                    dir="rtl"
                    disabled={!isEditing}
                    value={contactFormData.dominant_eye || ""}
                    onValueChange={(value) =>
                      setContactFormData((prev: any) => ({ ...prev, dominant_eye: value }))
                    }
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
              </div>

            </Card>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-4">
            <ContactLensDetailsTab
              contactLensDetailsData={contactLensDetailsData}
              onContactLensDetailsChange={(field, value) =>
                setContactLensDetailsData((prev: any) => ({ ...prev, [field]: value }))
              }
              isEditing={isEditing}
            />
            <ContactLensExamTab
              contactLensExamData={contactLensExamData}
              onContactLensExamChange={(field, value) =>
                setContactLensExamData((prev: any) => ({ ...prev, [field]: value }))
              }
              isEditing={isEditing}
            />
          </div>

        </div>

        <Tabs defaultValue="exam" className="w-full" dir="rtl" orientation="vertical">
          <div className="flex gap-6">
            <TabsList className="dark:bg-card/50 flex h-fit w-28 flex-col bg-cyan-800/10 p-1">
              <TabsTrigger value="exam" className="w-full justify-end text-right">
                <div className="w-full text-right">
                  <span className="font-medium">בדיקות</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="details" className="w-full justify-end text-right">
                <div className="w-full text-right">
                  <span className="font-medium">פרטים</span>
                </div>
              </TabsTrigger>
              <TabsTrigger value="notes" className="w-full justify-end text-right">
                <div className="w-full text-right">
                  <span className="font-medium">הערות</span>
                </div>
              </TabsTrigger>
            </TabsList>
            <div className="flex-1">
              <TabsContent value="exam" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-9" dir="ltr">
                  <div className="col-span-5">
                    <KeratometerContactLensTab
                      keratometerContactLensData={keratoCLData}
                      onKeratometerContactLensChange={(field, value) =>
                        setKeratoCLData((prev: any) => ({ ...prev, [field]: value }))
                      }
                      isEditing={isEditing}
                      needsMiddleSpacer={true}
                    />
                  </div>
                  <div className="col-span-2">
                    <SchirmerTestTab
                      schirmerTestData={schirmerData}
                      onSchirmerTestChange={(field, value) =>
                        setSchirmerData((prev: any) => ({ ...prev, [field]: value }))
                      }
                      isEditing={isEditing}
                      needsMiddleSpacer={true}
                      hideEyeLabels={true}
                    />
                  </div>
                  <div className="col-span-2">
                    <ContactLensDiametersTab
                      contactLensDiametersData={diametersData}
                      onContactLensDiametersChange={(field, value) =>
                        setDiametersData((prev: any) => ({ ...prev, [field]: value }))
                      }
                      isEditing={isEditing}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="details" className="mt-0 space-y-4">
                <ContactLensOrderTab
                  contactLensOrder={contactFormData}
                  onContactLensOrderChange={(field: any, value: any) =>
                    setContactFormData((prev: any) => ({ ...prev, [field]: value }))
                  }
                  isEditing={isEditing}
                />
              </TabsContent>
              <TabsContent value="notes" className="mt-0 space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <NotesCard
                    title="הערות"
                    value={contactFormData.notes || ""}
                    onChange={(value) =>
                      setContactFormData((prev: any) => ({ ...prev, notes: value }))
                    }
                    disabled={!isEditing}
                    placeholder="הערות..."
                  />
                  <NotesCard
                    title="הערות לספק"
                    value={contactFormData.supplier_notes || ""}
                    onChange={(value) =>
                      setContactFormData((prev: any) => ({ ...prev, supplier_notes: value }))
                    }
                    disabled={!isEditing}
                    placeholder="הערות לספק..."
                  />
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    </form>
  );
}


