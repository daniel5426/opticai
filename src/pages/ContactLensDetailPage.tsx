import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { 
  getContactLensById, 
  getContactEyesByContactLensId, 
  getContactLensOrderByContactLensId,
  updateContactLens,
  updateContactEye,
  updateContactLensOrder,
  createContactLens,
  createContactEye,
  createContactLensOrder
} from "@/lib/db/contact-lens-db"
import { 
  getBillingByOrderId, 
  getOrderLineItemsByBillingId, 
  createBilling, 
  updateBilling, 
  createOrderLineItem, 
  updateOrderLineItem, 
  deleteOrderLineItem 
} from "@/lib/db/billing-db"
import { ContactLens, ContactEye, ContactLensOrder, Client, Billing, OrderLineItem } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { BillingTab } from "@/components/BillingTab"

interface DateInputProps {
  name: string;
  value: string | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  disabled?: boolean;
}

function DateInput({ name, value, onChange, className, disabled }: DateInputProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);
  
  const openDatePicker = () => {
    if (dateInputRef.current && !disabled) {
      dateInputRef.current.showPicker();
    }
  };

  return (
    <div className="relative mt-1">
      <div 
        className={`text-sm text-right pr-10 h-8 rounded-md border px-3 py-2 border-input bg-transparent flex items-center ${disabled ? 'cursor-not-allowed bg-gray-100' : 'cursor-pointer'} ${className || ''}`}
        dir="rtl"
        onClick={openDatePicker}
      >
        {value ? new Date(value).toLocaleDateString('he-IL') : 'לחץ לבחירת תאריך'}
      </div>
      
      <input
        ref={dateInputRef}
        type="date"
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className="absolute opacity-0 h-0 w-0 overflow-hidden"
      />
      
      <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
        <svg 
          className="h-5 w-5 text-gray-400" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
}

interface ContactEyeSectionProps {
  eye: "R" | "L";
  data: ContactEye;
  onChange: (eye: "R" | "L", field: keyof ContactEye, value: string) => void;
  isEditing: boolean;
}

function ContactEyeSection({ eye, data, onChange, isEditing }: ContactEyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="grid grid-cols-8 gap-3 items-center mb-4" dir="rtl">
      <span className="text-md font-medium text-center">{eyeLabel}</span>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">K-H</Label>}
        <Input 
          type="number" 
          step="0.01" 
          value={data.k_h?.toString() || ""} 
          onChange={(e) => onChange(eye, "k_h", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">K-V</Label>}
        <Input 
          type="number" 
          step="0.01" 
          value={data.k_v?.toString() || ""} 
          onChange={(e) => onChange(eye, "k_v", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">BC</Label>}
        <Input 
          type="number" 
          step="0.01" 
          value={data.bc?.toString() || ""} 
          onChange={(e) => onChange(eye, "bc", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">SPH</Label>}
        <Input 
          type="number" 
          step="0.25" 
          value={data.sph?.toString() || ""} 
          onChange={(e) => onChange(eye, "sph", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">CYL</Label>}
        <Input 
          type="number" 
          step="0.25" 
          value={data.cyl?.toString() || ""} 
          onChange={(e) => onChange(eye, "cyl", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">VA</Label>}
        <Input 
          type="text" 
          value={data.va || ""} 
          onChange={(e) => onChange(eye, "va", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
      
      <div>
        {eye === "R" && <Label className="text-[12px] block text-center">דגם</Label>}
        <Input 
          type="text" 
          value={data.model || ""} 
          onChange={(e) => onChange(eye, "model", e.target.value)} 
          disabled={!isEditing} 
          className="h-8 text-xs" 
        />
      </div>
    </div>
  );
}

interface ContactLensDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  contactLensId?: string;
  onSave?: (contactLens: ContactLens, rightEye: ContactEye, leftEye: ContactEye, contactLensOrder: ContactLensOrder) => void;
  onCancel?: () => void;
}

export default function ContactLensDetailPage({ 
  mode = 'view', 
  clientId: propClientId, 
  contactLensId: propContactLensId,
  onSave,
  onCancel 
}: ContactLensDetailPageProps = {}) {
  let routeClientId: string | undefined, routeContactLensId: string | undefined;
  
  try {
    const params = useParams({ from: "/clients/$clientId/contact-lenses/$contactLensId" });
    routeClientId = params.clientId;
    routeContactLensId = params.contactLensId;
  } catch {
    try {
      const params = useParams({ from: "/clients/$clientId/contact-lenses/new" });
      routeClientId = params.clientId;
    } catch {
      routeClientId = undefined;
      routeContactLensId = undefined;
    }
  }
  
  const clientId = propClientId || routeClientId
  const contactLensId = propContactLensId || routeContactLensId
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [contactLens, setContactLens] = useState<ContactLens | null>(null)
  const [rightEye, setRightEye] = useState<ContactEye | null>(null)
  const [leftEye, setLeftEye] = useState<ContactEye | null>(null)
  const [contactLensOrder, setContactLensOrder] = useState<ContactLensOrder | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)
  const [orderLineItems, setOrderLineItems] = useState<OrderLineItem[]>([])
  const [deletedOrderLineItemIds, setDeletedOrderLineItemIds] = useState<number[]>([])
  
  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [formData, setFormData] = useState<ContactLens>(() => {
    if (isNewMode) {
      return {
        exam_date: new Date().toISOString().split('T')[0],
        type: '',
        examiner_name: ''
      } as ContactLens
    }
    return {} as ContactLens
  })
  const [rightEyeFormData, setRightEyeFormData] = useState<ContactEye>(isNewMode ? { contact_lens_id: 0, eye: 'R' } as ContactEye : {} as ContactEye)
  const [leftEyeFormData, setLeftEyeFormData] = useState<ContactEye>(isNewMode ? { contact_lens_id: 0, eye: 'L' } as ContactEye : {} as ContactEye)
  const [contactLensOrderFormData, setContactLensOrderFormData] = useState<ContactLensOrder>(isNewMode ? { contact_lens_id: 0 } as ContactLensOrder : {} as ContactLensOrder)
  const [billingFormData, setBillingFormData] = useState<Billing>(isNewMode ? {} as Billing : {} as Billing)
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()

  const handleDeleteOrderLineItem = (id: number) => {
    if (id > 0) {
      setDeletedOrderLineItemIds(prev => [...prev, id])
    }
    setOrderLineItems(prev => prev.filter(item => item.id !== id))
  }
  
  const fullName = client ? `${client.first_name} ${client.last_name}`.trim() : ''
  
  return (
    <SidebarProvider dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
      <AppSidebar variant="inset" side="right" />
      <SidebarInset style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          clientName={fullName}
          clientBackLink={`/clients/${clientId}`}
          examInfo={isNewMode ? "עדשות מגע חדש" : `עדשות מגע מס' ${contactLensId}`}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <Tabs defaultValue="exam" className="w-full" dir="rtl">
            <div className="flex justify-between items-center mb-4">
              <TabsList className="grid grid-cols-2 w-auto">
                <TabsTrigger value="exam">עדשות מגע</TabsTrigger>
                <TabsTrigger value="billing">חיובים</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                {isNewMode && onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    ביטול
                  </Button>
                )}
                <Button 
                  variant={isEditing ? "outline" : "default"} 
                  onClick={() => {
                    if (isNewMode || isEditing) {
                      // handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                >
                  {isNewMode ? "שמור עדשות מגע" : (isEditing ? "שמור שינויים" : "ערוך עדשות מגע")}
                </Button>
              </div>
            </div>
            
            <TabsContent value="exam" className="space-y-4">
              <form ref={formRef} className="pt-4 pb-10" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-md">
                    <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                      <div className="col-span-1">
                        <label className="font-semibold text-base">תאריך בדיקה</label>
                        <DateInput
                          name="exam_date"
                          className="h-9"
                          value={formData.exam_date}
                          onChange={() => {}}
                          disabled={!isEditing}
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <label className="font-semibold text-base">סוג עדשה</label>
                        <div className="h-1"></div>
                        <Select dir="rtl"
                          disabled={!isEditing}
                          value={formData.type || ''} 
                          onValueChange={() => {}}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="בחר סוג" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="יומיות" className="text-sm">יומיות</SelectItem>
                            <SelectItem value="חודשיות" className="text-sm">חודשיות</SelectItem>
                            <SelectItem value="שנתיות" className="text-sm">שנתיות</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-1">
                        <label className="font-semibold text-base">שם הבוחן</label>
                        <div className="h-1"></div>
                        <Input 
                          type="text"
                          name="examiner_name"
                          value={formData.examiner_name || ''}
                          onChange={() => {}}
                          disabled={!isEditing}
                          className="text-sm h-9"
                          placeholder="שם הבוחן"
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <label className="font-semibold text-base">קוטר אישון</label>
                        <div className="h-1"></div>
                        <Input 
                          type="number"
                          step="0.1"
                          name="pupil_diameter"
                          value={formData.pupil_diameter || ''}
                          onChange={() => {}}
                          disabled={!isEditing}
                          className="text-sm h-9"
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <label className="font-semibold text-base">קוטר קרנית</label>
                        <div className="h-1"></div>
                        <Input 
                          type="number"
                          step="0.1"
                          name="corneal_diameter"
                          value={formData.corneal_diameter || ''}
                          onChange={() => {}}
                          disabled={!isEditing}
                          className="text-sm h-9"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Card>
                    <CardContent className="px-4 pt-4 space-y-2">
                      <div className="relative mb-4 pt-2">
                        <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                          נתוני עיניים - עדשות מגע
                        </div>
                      </div>
                      <ContactEyeSection eye="R" data={rightEyeFormData} onChange={() => {}} isEditing={isEditing} />
                      <ContactEyeSection eye="L" data={leftEyeFormData} onChange={() => {}} isEditing={isEditing} />
                    </CardContent>
                  </Card>

                  <Tabs defaultValue="prescription" className="w-full" dir="rtl">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="prescription">מרשם</TabsTrigger>
                      <TabsTrigger value="order">הזמנה</TabsTrigger>
                      <TabsTrigger value="notes">הערות</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="prescription" className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">פרטי עדשות מגע</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">ספק</Label>
                            <Input
                              name="supplier"
                              value={rightEyeFormData.supplier || ''}
                              onChange={() => {}}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">חומר</Label>
                            <Input
                              name="material"
                              value={rightEyeFormData.material || ''}
                              onChange={() => {}}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="order" className="space-y-4">
                      <Card>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-sm">סניף</Label>
                              <Input
                                name="branch"
                                value={contactLensOrderFormData.branch || ''}
                                onChange={() => {}}
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">סטטוס הזמנה</Label>
                              <Select dir="rtl"
                                disabled={!isEditing}
                                value={contactLensOrderFormData.order_status || ''} 
                                onValueChange={() => {}}
                              >
                                <SelectTrigger className="mt-1.5">
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
                              <Label className="text-sm">יועץ</Label>
                              <Input
                                name="advisor"
                                value={contactLensOrderFormData.advisor || ''}
                                onChange={() => {}}
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="notes" className="space-y-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm">הערות</Label>
                              <Textarea
                                name="notes"
                                value={formData.notes || ''}
                                onChange={() => {}}
                                disabled={!isEditing}
                                className="mt-1.5 min-h-[100px]"
                                placeholder="הכנס הערות כלליות..."
                              />
                            </div>
                            <div>
                              <Label className="text-sm">הערות לספק</Label>
                              <Textarea
                                name="notes_for_supplier"
                                value={formData.notes_for_supplier || ''}
                                onChange={() => {}}
                                disabled={!isEditing}
                                className="mt-1.5 min-h-[100px]"
                                placeholder="הכנס הערות לספק..."
                              />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="billing" className="space-y-4">
              <BillingTab
                billingFormData={billingFormData}
                setBillingFormData={setBillingFormData}
                orderLineItems={orderLineItems}
                setOrderLineItems={setOrderLineItems}
                isEditing={isEditing}
                handleDeleteOrderLineItem={handleDeleteOrderLineItem}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}