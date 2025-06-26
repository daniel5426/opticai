import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
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
import { getBillingByContactLensId } from "@/lib/db/contact-lens-db"
import { ContactLens, ContactEye, ContactLensOrder, Client, Billing, OrderLineItem, User } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { BillingTab } from "@/components/BillingTab"
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"
import { getAllUsers } from "@/lib/db/users-db"
import { LookupSelect } from "@/components/ui/lookup-select"

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

function SchirmerKSection({ eye, data, onChange, isEditing }: ContactEyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-6" dir="rtl">
      <div className="grid grid-cols-24 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">TEST</Label>}
          <Input 
            type="number" 
            step="0.1" 
            value={data.schirmer_test?.toString() || ""} 
            onChange={(e) => onChange(eye, "schirmer_test", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">BUT</Label>}
          <Input 
            type="number" 
            step="0.1" 
            value={data.schirmer_but?.toString() || ""} 
            onChange={(e) => onChange(eye, "schirmer_but", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">RH</Label>}
        <Input 
          type="number" 
          step="0.01" 
          value={data.k_h?.toString() || ""} 
          onChange={(e) => onChange(eye, "k_h", e.target.value)} 
          disabled={!isEditing} 
            className="h-8 text-xs px-1" 
        />
      </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">RV</Label>}
        <Input 
          type="number" 
          step="0.01" 
          value={data.k_v?.toString() || ""} 
          onChange={(e) => onChange(eye, "k_v", e.target.value)} 
          disabled={!isEditing} 
            className="h-8 text-xs px-1" 
        />
      </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">AVG</Label>}
          <Input 
            type="number" 
            step="0.01" 
            value={data.k_avg?.toString() || ""} 
            onChange={(e) => onChange(eye, "k_avg", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">CYL</Label>}
          <Input 
            type="number" 
            step="0.01" 
            value={data.k_cyl?.toString() || ""} 
            onChange={(e) => onChange(eye, "k_cyl", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">AX</Label>}
          <Input 
            type="number" 
            min="0" 
            max="180" 
            value={data.k_ax?.toString() || ""} 
            onChange={(e) => onChange(eye, "k_ax", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-3">
          {eye === "R" && <Label className="text-[12px] block text-center">ECC</Label>}
          <Input 
            type="number" 
            step="0.01" 
            value={data.k_ecc?.toString() || ""} 
            onChange={(e) => onChange(eye, "k_ecc", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
    </div>
  );
}

function ExamSection({ eye, data, onChange, isEditing }: ContactEyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-21 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-2">
        {eye === "R" && <Label className="text-[12px] block text-center">BC</Label>}
        <Input 
          type="number" 
          step="0.01" 
          value={data.bc?.toString() || ""} 
          onChange={(e) => onChange(eye, "bc", e.target.value)} 
          disabled={!isEditing} 
            className="h-8 text-xs px-1" 
        />
      </div>
        <div className="col-span-2">
          {eye === "R" && <Label className="text-[12px] block text-center">BC-2</Label>}
          <Input 
            type="number" 
            step="0.01" 
            value={data.bc_2?.toString() || ""} 
            onChange={(e) => onChange(eye, "bc_2", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label className="text-[12px] block text-center">OZ</Label>}
          <Input 
            type="number" 
            step="0.1" 
            value={data.oz?.toString() || ""} 
            onChange={(e) => onChange(eye, "oz", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label className="text-[12px] block text-center">DIAM</Label>}
          <Input 
            type="number" 
            step="0.1" 
            value={data.diam?.toString() || ""} 
            onChange={(e) => onChange(eye, "diam", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-2">
        {eye === "R" && <Label className="text-[12px] block text-center">SPH</Label>}
        <Input 
          type="number" 
          step="0.25" 
          value={data.sph?.toString() || ""} 
          onChange={(e) => onChange(eye, "sph", e.target.value)} 
          disabled={!isEditing} 
            className="h-8 text-xs px-1" 
        />
      </div>
        <div className="col-span-2">
        {eye === "R" && <Label className="text-[12px] block text-center">CYL</Label>}
        <Input 
          type="number" 
          step="0.25" 
          value={data.cyl?.toString() || ""} 
          onChange={(e) => onChange(eye, "cyl", e.target.value)} 
          disabled={!isEditing} 
            className="h-8 text-xs px-1" 
        />
      </div>
        <div className="col-span-2">
          {eye === "R" && <Label className="text-[12px] block text-center">AXIS</Label>}
          <Input 
            type="number" 
            min="0" 
            max="180" 
            value={data.ax?.toString() || ""} 
            onChange={(e) => onChange(eye, "ax", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label className="text-[12px] block text-center">ADD</Label>}
          <Input 
            type="number" 
            step="0.25" 
            value={data.read_ad?.toString() || ""} 
            onChange={(e) => onChange(eye, "read_ad", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-3">
        {eye === "R" && <Label className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
        <Input 
              type="number" 
              step="0.1"
              value={data.va?.toString() || ""} 
          onChange={(e) => onChange(eye, "va", e.target.value)} 
          disabled={!isEditing} 
              className="h-8 text-xs px-1 pl-6" 
        />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
      </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label className="text-[12px] block text-center">J</Label>}
          <Input 
            type="number" 
            step="0.1"
            value={data.j?.toString() || ""} 
            onChange={(e) => onChange(eye, "j", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
    </div>
  );
}

function CombinedVaContactLensSection({ contactLens, onChange, isEditing }: { 
  contactLens: ContactLens, 
  onChange: (field: keyof ContactLens, value: string) => void, 
  isEditing: boolean
}) {
  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-21 gap-4 flex-1" dir="ltr">
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-3">
          <div className="relative" dir="ltr">
            <Input 
              type="number" 
              step="0.1" 
              value={contactLens.comb_va?.toString() || ""} 
              onChange={(e) => onChange("comb_va", e.target.value)} 
              disabled={!isEditing} 
              className="h-8 text-xs px-1 pl-6" 
              placeholder="0.0"
            />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2"></div>
      </div>
      <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>
    </div>
  );
}

function ContactDetailsSection({ eye, data, onChange, isEditing }: ContactEyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-8 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Type</Label>}
          <Input 
            type="text" 
            value={data.lens_type || ""} 
            onChange={(e) => onChange(eye, "lens_type", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Model</Label>}
        <Input 
          type="text" 
          value={data.model || ""} 
          onChange={(e) => onChange(eye, "model", e.target.value)} 
          disabled={!isEditing} 
            className="h-8 text-xs px-1" 
        />
      </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Supplier</Label>}
          <LookupSelect
            value={data.supplier || ""}
            onChange={(value) => onChange(eye, "supplier", value)}
            lookupType="supplier"
            placeholder="בחר ספק..."
            disabled={!isEditing}
            className="h-8 text-xs"
          />
        </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Material</Label>}
          <LookupSelect
            value={data.material || ""}
            onChange={(value) => onChange(eye, "material", value)}
            lookupType="contactEyeMaterial"
            placeholder="בחר חומר..."
            disabled={!isEditing}
            className="h-8 text-xs"
          />
        </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Color</Label>}
          <LookupSelect
            value={data.color || ""}
            onChange={(value) => onChange(eye, "color", value)}
            lookupType="color"
            placeholder="בחר צבע..."
            disabled={!isEditing}
            className="h-8 text-xs"
          />
        </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Qty</Label>}
          <Input 
            type="number" 
            value={data.quantity?.toString() || ""} 
            onChange={(e) => onChange(eye, "quantity", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">Order Qty</Label>}
          <Input 
            type="number" 
            value={data.order_quantity?.toString() || ""} 
            onChange={(e) => onChange(eye, "order_quantity", e.target.value)} 
            disabled={!isEditing} 
            className="h-8 text-xs px-1" 
          />
        </div>
        <div className="col-span-1">
          {eye === "R" && <Label className="text-[12px] block text-center">DX</Label>}
          <div className="flex items-center justify-center h-8">
            <input 
              type="checkbox" 
              checked={data.dx || false} 
              onChange={(e) => onChange(eye, "dx", e.target.checked.toString())} 
              disabled={!isEditing} 
              className="h-4 w-4" 
            />
          </div>
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
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
  const [users, setUsers] = useState<User[]>([])
  const { currentUser } = useUser()
  
  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState('contact-lenses')
  const [formData, setFormData] = useState<ContactLens>(isNewMode ? {
    client_id: Number(clientId),
    exam_date: new Date().toISOString().split('T')[0],
    type: '',
    user_id: currentUser?.id,
    pupil_diameter: undefined,
    corneal_diameter: undefined,
    eyelid_aperture: undefined,
    comb_va: undefined
  } as ContactLens : {} as ContactLens)
  const [rightEyeFormData, setRightEyeFormData] = useState<ContactEye>(isNewMode ? { eye: 'R' } as ContactEye : {} as ContactEye)
  const [leftEyeFormData, setLeftEyeFormData] = useState<ContactEye>(isNewMode ? { eye: 'L' } as ContactEye : {} as ContactEye)
  const [contactLensOrderFormData, setContactLensOrderFormData] = useState<ContactLensOrder>(isNewMode ? {} as ContactLensOrder : {} as ContactLensOrder)
  const [billingFormData, setBillingFormData] = useState<Billing>(isNewMode ? {} as Billing : {} as Billing)
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  
  const handleTabChange = (value: string) => {
    if (clientId && value !== 'contact-lenses') {
      navigate({ 
        to: "/clients/$clientId", 
        params: { clientId: String(clientId) },
        search: { tab: value } 
      })
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load users for display purposes
        const usersData = await getAllUsers()
        setUsers(usersData)
        
        if (clientId) {
          const clientData = await getClientById(Number(clientId))
          setClient(clientData || null)
        }
        
        if (contactLensId) {
          const contactLensData = await getContactLensById(Number(contactLensId))
          setContactLens(contactLensData || null)
          
          if (contactLensData) {
            const [contactEyesData, contactLensOrderData, billingData] = await Promise.all([
              getContactEyesByContactLensId(Number(contactLensId)),
              getContactLensOrderByContactLensId(Number(contactLensId)),
              getBillingByContactLensId(Number(contactLensId))
            ])
            
            const rightEyeData = contactEyesData.find(e => e.eye === "R")
            const leftEyeData = contactEyesData.find(e => e.eye === "L")
            
            setRightEye(rightEyeData || null)
            setLeftEye(leftEyeData || null)
            setContactLensOrder(contactLensOrderData || null)
            setBilling(billingData || null)
            
            if (billingData && billingData.id) {
              const orderLineItemsData = await getOrderLineItemsByBillingId(billingData.id)
              setOrderLineItems(orderLineItemsData || [])
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clientId, contactLensId])
  
  useEffect(() => {
    if (contactLens) {
      setFormData({ ...contactLens })
    }
    if (rightEye) {
      setRightEyeFormData({ ...rightEye })
    }
    if (leftEye) {
      setLeftEyeFormData({ ...leftEye })
    }
    if (contactLensOrder) {
      setContactLensOrderFormData({ ...contactLensOrder })
    }
    if (billing) {
      setBillingFormData({ ...billing })
    }
  }, [contactLens, rightEye, leftEye, contactLensOrder, billing])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
      setFormData(prev => ({ ...prev, [name]: value }))
    }

  const handleContactLensFieldChange = (field: keyof ContactLens, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof ContactLens)[] = [
      "comb_va", "pupil_diameter", "corneal_diameter", "eyelid_aperture"
    ];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleContactEyeFieldChange = (
    eye: 'R' | 'L',
    field: keyof ContactEye,
    rawValue: string
  ) => {
    let processedValue: string | number | boolean | undefined = rawValue;
  
    const numericFields: (keyof ContactEye)[] = [
      "k_h", "k_v", "k_avg", "k_cyl", "k_ax", "k_ecc", "bc", "bc_2", "oz", "diam", "sph", "cyl", "ax", "read_ad", "schirmer_test", "schirmer_but", "quantity", "order_quantity", "va", "j"
    ];
    const integerFields: (keyof ContactEye)[] = ["ax", "k_ax", "diam", "quantity", "order_quantity"];
    const booleanFields: (keyof ContactEye)[] = ["dx"];
  
    if (booleanFields.includes(field)) {
      processedValue = rawValue === "true";
    } else if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "") {
      processedValue = undefined;
    }
  
    if (eye === 'R') {
      setRightEyeFormData(prev => ({ ...prev, [field]: processedValue }));
    } else {
      setLeftEyeFormData(prev => ({ ...prev, [field]: processedValue }));
    }
  };

  const handleDeleteOrderLineItem = (id: number) => {
    if (id > 0) {
      setDeletedOrderLineItemIds(prev => [...prev, id])
    }
    setOrderLineItems(prev => prev.filter(item => item.id !== id))
  }

  const handleSave = async () => {
    console.log('Starting save process...')
    
    if (!formData.type) {
      toast.error("אנא בחר סוג עדשה")
      return
    }
    
    try {
      if (isNewMode) {
        console.log('Creating new contact lens...')
        
        const newContactLens = await createContactLens({
          client_id: Number(clientId),
          exam_date: formData.exam_date,
          type: formData.type,
          user_id: formData.user_id,
          comb_va: formData.comb_va,
          pupil_diameter: formData.pupil_diameter,
          corneal_diameter: formData.corneal_diameter,
          eyelid_aperture: formData.eyelid_aperture,
          notes: formData.notes,
          notes_for_supplier: formData.notes_for_supplier
        })
        
        if (newContactLens && newContactLens.id) {
          const [newRightEye, newLeftEye, newContactLensOrder] = await Promise.all([
            createContactEye({
              ...rightEyeFormData,
              contact_lens_id: newContactLens.id,
              eye: 'R',
            }),
            createContactEye({
              ...leftEyeFormData,
              contact_lens_id: newContactLens.id,
              eye: 'L',
            }),
            createContactLensOrder({
              ...contactLensOrderFormData,
              contact_lens_id: newContactLens.id,
            })
          ])
          
          let newBilling: Billing | null = null
          let savedOrderLineItems: OrderLineItem[] = []
          
          const hasBillingData = Object.values(billingFormData).some(value => 
            value !== undefined && value !== null && value !== ''
          );
          
          if (hasBillingData || orderLineItems.length > 0) {
            console.log('Creating billing for new contact lens...')
            newBilling = await createBilling({
              ...billingFormData,
              contact_lens_id: newContactLens.id,
            })
            
            if (newBilling && newBilling.id && orderLineItems.length > 0) {
              console.log('Creating line items for new contact lens...')
              savedOrderLineItems = await Promise.all(
                orderLineItems.map(item => {
                  const { id, ...itemWithoutId } = item;
                  return createOrderLineItem({
                    ...itemWithoutId,
                    billings_id: newBilling!.id!
                  })
                })
              ).then(results => results.filter(Boolean) as OrderLineItem[])
            }
          }
          
          if (newRightEye && newLeftEye && newContactLensOrder) {
            toast.success("עדשות מגע חדשות נוצרו בהצלחה")
            if (onSave) {
              onSave(newContactLens, newRightEye, newLeftEye, newContactLensOrder)
            }
          } else {
            toast.error("לא הצלחנו ליצור את נתוני עדשות המגע")
          }
        } else {
          toast.error("לא הצלחנו ליצור את עדשות המגע")
        }
      } else {
        const [updatedContactLens, updatedRightEye, updatedLeftEye, updatedContactLensOrder] = await Promise.all([
          updateContactLens(formData),
          updateContactEye(rightEyeFormData),
          updateContactEye(leftEyeFormData),
          contactLensOrderFormData.id ? updateContactLensOrder(contactLensOrderFormData) : createContactLensOrder({
            ...contactLensOrderFormData,
            contact_lens_id: formData.id!
          })
        ])
        
        let updatedBilling: Billing | null = null
        
        const hasBillingData = Object.values(billingFormData).some(value => 
          value !== undefined && value !== null && value !== ''
        );
        
        if (billingFormData.id) {
          console.log('Updating existing billing...')
          const billingResult = await updateBilling(billingFormData)
          updatedBilling = billingResult || null
        } else if (hasBillingData || orderLineItems.length > 0) {
          console.log('Creating new billing...')
          const billingResult = await createBilling({
            ...billingFormData,
            contact_lens_id: formData.id!
          })
          updatedBilling = billingResult || null
        }
        
        if (updatedBilling && updatedBilling.id) {
          if (deletedOrderLineItemIds.length > 0) {
            await Promise.all(
              deletedOrderLineItemIds.map(id => deleteOrderLineItem(id))
            )
            setDeletedOrderLineItemIds([])
          }
          
          const lineItemResults = await Promise.all(
            orderLineItems.map(async (item) => {
              if (item.id && item.id > 0) {
                return updateOrderLineItem({
                  ...item,
                  billings_id: updatedBilling.id!
                })
              } else {
                const { id, ...itemWithoutId } = item;
                return createOrderLineItem({
                  ...itemWithoutId,
                  billings_id: updatedBilling.id!
                })
              }
            })
          )
        }
        
        if (updatedContactLens && updatedRightEye && updatedLeftEye && updatedContactLensOrder) {
          setIsEditing(false)
          setContactLens(updatedContactLens)
          setRightEye(updatedRightEye)
          setLeftEye(updatedLeftEye)
          setContactLensOrder(updatedContactLensOrder)
          if (updatedBilling) {
            setBilling(updatedBilling)
          }
          setFormData({ ...updatedContactLens })
          setRightEyeFormData({ ...updatedRightEye })
          setLeftEyeFormData({ ...updatedLeftEye })
          setContactLensOrderFormData({ ...updatedContactLensOrder })
          if (updatedBilling) {
            setBillingFormData({ ...updatedBilling })
          }
          toast.success("פרטי עדשות המגע עודכנו בהצלחה")
          if (onSave) {
            onSave(updatedContactLens, updatedRightEye, updatedLeftEye, updatedContactLensOrder)
          }
        } else {
          toast.error("לא הצלחנו לשמור את השינויים")
        }
      }
    } catch (error) {
      console.error('Error saving contact lens:', error)
      toast.error("שגיאה בשמירת עדשות המגע")
    }
  }
  
  if (loading) {
    return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients" 
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">טוען...</h1>
        </div>
      </>
    )
  }
  
  if (!client || (!isNewMode && (!contactLens || !rightEye || !leftEye))) {
    return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients" 
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">{isNewMode ? "לקוח לא נמצא" : "עדשות מגע לא נמצאו"}</h1>
        </div>
      </>
    )
  }

  const fullName = client ? `${client.first_name} ${client.last_name}`.trim() : ''
  
  return (
    <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          client={client}
          clientBackLink={`/clients/${clientId}`}
          examInfo={isNewMode ? "עדשות מגע חדש" : `עדשות מגע מס' ${contactLensId}`}
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
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
                      handleSave();
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
                          onChange={handleInputChange}
                          disabled={!isEditing}
                        />
                      </div>
                      
                      <div className="col-span-1">
                        <label className="font-semibold text-base">סוג עדשה</label>
                        <div className="h-1"></div>
                        <Select dir="rtl"
                          disabled={!isEditing}
                          value={formData.type || ''} 
                          onValueChange={(value) => handleSelectChange(value, 'type')}
                        >
                          <SelectTrigger className="h-9 text-sm w-full">
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
                        <label className="font-semibold text-base">בודק</label>
                        <div className="h-1"></div>
                        {isEditing ? (
                          <UserSelect
                            value={formData.user_id}
                            onValueChange={(userId) => setFormData(prev => ({ ...prev, user_id: userId }))}
                          />
                        ) : (
                          <div className="border h-9 px-3 rounded-md text-sm flex items-center">
                            {formData.user_id ? (
                              users.find(u => u.id === formData.user_id)?.username || 'משתמש לא נמצא'
                            ) : 'לא נבחר בודק'}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-1">
                        <label className="font-semibold text-base">קוטר אישון</label>
                        <div className="h-1"></div>
                        <Input 
                          type="number"
                          step="0.1"
                          name="pupil_diameter"
                          value={formData.pupil_diameter || ''}
                          onChange={handleInputChange}
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
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className="text-sm h-9"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <Tabs defaultValue="exam-details" className="w-full pt-2">
                    <div className="flex flex-row-reverse gap-4">
                      <TabsList className="flex flex-col py-4 h-fit min-w-[140px] bg-secondary/50 gap-2">
                        <TabsTrigger value="exam-details" className="justify-start">פרטי בדיקה</TabsTrigger>
                        <TabsTrigger value="contact-details" className="justify-start">פרטי עדשות</TabsTrigger>
                      </TabsList>

                      <div className="flex-1">
                        <TabsContent value="exam-details">
                  <Card>
                            <CardContent className="px-4 pt-4 space-y-1">
                      <div className="relative mb-4 pt-2">
                        <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                                  נתוני בדיקה - עדשות מגע
                        </div>
                      </div>
                              <ExamSection eye="R" data={rightEyeFormData} onChange={handleContactEyeFieldChange} isEditing={isEditing} />
                              <CombinedVaContactLensSection contactLens={formData} onChange={handleContactLensFieldChange} isEditing={isEditing} />
                              <ExamSection eye="L" data={leftEyeFormData} onChange={handleContactEyeFieldChange} isEditing={isEditing} />
                    </CardContent>
                  </Card>
                        </TabsContent>

                        <TabsContent value="contact-details">
                          <Card>
                            <CardContent className="px-4 pt-4 space-y-1">
                              <div className="relative mb-4 pt-2">
                                <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                                  פרטי עדשות מגע
                                </div>
                              </div>
                              <ContactDetailsSection eye="R" data={rightEyeFormData} onChange={handleContactEyeFieldChange} isEditing={isEditing} />
                              <div className="h-2"></div>
                              <ContactDetailsSection eye="L" data={leftEyeFormData} onChange={handleContactEyeFieldChange} isEditing={isEditing} />
                            </CardContent>
                          </Card>
                        </TabsContent>
                      </div>
                    </div>
                  </Tabs>

                  <Tabs defaultValue="prescription" className="w-full" dir="rtl">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="prescription">מרשם</TabsTrigger>
                      <TabsTrigger value="order">הזמנה</TabsTrigger>
                      <TabsTrigger value="notes">הערות</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="prescription" className="space-y-4">
                      <Card>
                        <CardContent className="px-4 pt-4">
                          <div className="flex gap-6" dir="rtl">
                            <div className="w-48">
                              <div className="relative pt-2">
                                <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                                  מדידות
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                          <div>
                                    <Label className="text-[12px] block text-center">קוטר אישון</Label>
                            <Input
                                      type="number"
                                      step="0.1"
                                      value={formData.pupil_diameter?.toString() || ''}
                                      onChange={(e) => handleContactLensFieldChange('pupil_diameter', e.target.value)}
                              disabled={!isEditing}
                                      className="h-8 text-xs px-1"
                            />
                          </div>
                          <div>
                                    <Label className="text-[12px] block text-center">קוטר קרנית</Label>
                            <Input
                                      type="number"
                                      step="0.1"
                                      value={formData.corneal_diameter?.toString() || ''}
                                      onChange={(e) => handleContactLensFieldChange('corneal_diameter', e.target.value)}
                              disabled={!isEditing}
                                      className="h-8 text-xs px-1"
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-[12px] block text-center">פתח עפעף</Label>
                                    <Input
                                      type="number"
                                      step="0.1"
                                      value={formData.eyelid_aperture?.toString() || ''}
                                      onChange={(e) => handleContactLensFieldChange('eyelid_aperture', e.target.value)}
                                      disabled={!isEditing}
                                      className="h-8 text-xs px-1"
                                    />
                                  </div>
                                  <div></div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="w-px bg-border"></div>
                            
                            <div className="flex-1 flex gap-6">
                              <div className="w-54">
                                <div className="relative mb-4 pt-2">
                                  <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background font-medium text-muted-foreground">
                                    Schirmer Test
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                                    <div className="grid grid-cols-6 gap-4 flex-1 pb-2" dir="ltr">
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">TEST</Label>
                                        <Input 
                                          type="number" 
                                          step="0.1" 
                                          value={rightEyeFormData.schirmer_test?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "schirmer_test", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">BUT</Label>
                                        <Input 
                                          type="number" 
                                          step="0.1" 
                                          value={rightEyeFormData.schirmer_but?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "schirmer_but", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="h-6"></div>
                                  <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                                    <div className="grid grid-cols-6 gap-4 flex-1 pb-2" dir="ltr">
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.1" 
                                          value={leftEyeFormData.schirmer_test?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "schirmer_test", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.1" 
                                          value={leftEyeFormData.schirmer_but?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "schirmer_but", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="w-px bg-border"></div>
                              
                              <div className="flex-1">
                                <div className="relative mb-4 pt-2">
                                  <div className="absolute top-[-27px] right-1/2 transform translate-x-1/2 bg-background px-2 font-medium text-muted-foreground">
                                    קרטומטר
                                  </div>
                                </div>
                                <div className="space-y-1">
                                                                    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                                    <div className="grid grid-cols-18 gap-4 flex-1 pb-2" dir="ltr">
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">RH</Label>
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={rightEyeFormData.k_h?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "k_h", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">RV</Label>
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={rightEyeFormData.k_v?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "k_v", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">AVG</Label>
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={rightEyeFormData.k_avg?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "k_avg", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">CYL</Label>
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={rightEyeFormData.k_cyl?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "k_cyl", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">AX</Label>
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          max="180" 
                                          value={rightEyeFormData.k_ax?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "k_ax", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Label className="text-[12px] block text-center">ECC</Label>
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={rightEyeFormData.k_ecc?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("R", "k_ecc", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                    </div>
                                    <span className="text-md font-medium pr-2 flex items-center justify-center w-6 pt-2">R</span>
                                  </div>
                                  <div className="h-6"></div>
                                                                    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                                    <div className="grid grid-cols-18 gap-4 flex-1 pb-2" dir="ltr">
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={leftEyeFormData.k_h?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "k_h", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={leftEyeFormData.k_v?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "k_v", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={leftEyeFormData.k_avg?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "k_avg", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={leftEyeFormData.k_cyl?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "k_cyl", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          min="0" 
                                          max="180" 
                                          value={leftEyeFormData.k_ax?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "k_ax", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                      <div className="col-span-3">
                                        <Input 
                                          type="number" 
                                          step="0.01" 
                                          value={leftEyeFormData.k_ecc?.toString() || ""} 
                                          onChange={(e) => handleContactEyeFieldChange("L", "k_ecc", e.target.value)} 
                                          disabled={!isEditing} 
                                          className="h-8 text-xs px-1" 
                                        />
                                      </div>
                                    </div>
                                    <span className="text-md font-medium pr-2 flex items-center justify-center w-6 pb-2">L</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="order" className="space-y-4">
                      <Card>
                        <CardContent className="space-y-4 pt-4">
                          <div className="grid grid-cols-5 gap-3">
                            <div>
                              <Label className="text-sm">סניף</Label>
                              <LookupSelect
                                value={contactLensOrderFormData.branch || ''}
                                onChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, branch: value }))}
                                lookupType="clinic"
                                placeholder="בחר או הקלד סניף..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">אספקה בסניף</Label>
                              <LookupSelect
                                value={contactLensOrderFormData.supply_in_branch || ''}
                                onChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, supply_in_branch: value }))}
                                lookupType="clinic"
                                placeholder="בחר או הקלד סניף..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">סטטוס הזמנה</Label>
                              <Select dir="rtl"
                                disabled={!isEditing}
                                value={contactLensOrderFormData.order_status || ''} 
                                onValueChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, order_status: value }))}
                              >
                                <SelectTrigger className="mt-1.5 h-10 w-full">
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
                              <LookupSelect
                                value={contactLensOrderFormData.advisor || ''}
                                onChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, advisor: value }))}
                                lookupType="advisor"
                                placeholder="בחר או הקלד יועץ..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">משלוח</Label>
                              <Input
                                name="deliverer"
                                value={contactLensOrderFormData.deliverer || ''}
                                onChange={(e) => setContactLensOrderFormData(prev => ({ ...prev, deliverer: e.target.value }))}
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-3">
                            <div>
                              <Label className="text-sm">תאריך משלוח</Label>
                              <DateInput
                                name="delivery_date"
                                value={contactLensOrderFormData.delivery_date}
                                onChange={(e) => setContactLensOrderFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">עדיפות</Label>
                              <Select dir="rtl"
                                disabled={!isEditing}
                                value={contactLensOrderFormData.priority || ''} 
                                onValueChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, priority: value }))}
                              >
                                <SelectTrigger className="mt-1.5 h-10 w-full">
                                  <SelectValue placeholder="בחר עדיפות" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="רגיל" className="text-sm">רגיל</SelectItem>
                                  <SelectItem value="דחוף" className="text-sm">דחוף</SelectItem>
                                  <SelectItem value="גבוה" className="text-sm">גבוה</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-sm">תאריך מובטח</Label>
                              <DateInput
                                name="guaranteed_date"
                                value={contactLensOrderFormData.guaranteed_date}
                                onChange={(e) => setContactLensOrderFormData(prev => ({ ...prev, guaranteed_date: e.target.value }))}
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">תאריך אישור</Label>
                              <DateInput
                                name="approval_date"
                                value={contactLensOrderFormData.approval_date}
                                onChange={(e) => setContactLensOrderFormData(prev => ({ ...prev, approval_date: e.target.value }))}
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">תמיסת ניקוי</Label>
                              <LookupSelect
                                value={contactLensOrderFormData.cleaning_solution || ''}
                                onChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, cleaning_solution: value }))}
                                lookupType="cleaningSolution"
                                placeholder="בחר או הקלד תמיסת ניקוי..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-3">
                            <div>
                              <Label className="text-sm">תמיסת חיטוי</Label>
                              <LookupSelect
                                value={contactLensOrderFormData.disinfection_solution || ''}
                                onChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, disinfection_solution: value }))}
                                lookupType="disinfectionSolution"
                                placeholder="בחר או הקלד תמיסת חיטוי..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">תמיסת שטיפה</Label>
                              <LookupSelect
                                value={contactLensOrderFormData.rinsing_solution || ''}
                                onChange={(value) => setContactLensOrderFormData(prev => ({ ...prev, rinsing_solution: value }))}
                                lookupType="rinsingSolution"
                                placeholder="בחר או הקלד תמיסת שטיפה..."
                                disabled={!isEditing}
                                className="mt-1.5"
                              />
                            </div>
                            <div></div>
                            <div></div>
                            <div></div>
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
                              onChange={handleInputChange}
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
                              onChange={handleInputChange}
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
      </>
    )
}