import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getClientById } from "@/lib/db/clients-db"
import { getExamById } from "@/lib/db/exams-db"
import { 
  getOrderById, 
  getOrderEyesByOrderId, 
  getOrderLensByOrderId, 
  getFrameByOrderId,
  getOrderDetailsByOrderId,
  updateOrder,
  updateOrderEye,
  updateOrderLens,
  updateFrame,
  updateOrderDetails,
  createOrder,
  createOrderEye,
  createOrderLens,
  createFrame,
  createOrderDetails
} from "@/lib/db/orders-db"
import { 
  getBillingByOrderId, 
  getOrderLineItemsByBillingId, 
  createBilling, 
  updateBilling, 
  createOrderLineItem, 
  updateOrderLineItem, 
  deleteOrderLineItem 
} from "@/lib/db/billing-db"
import { Order, OrderEye, OrderLens, Frame, OrderDetails, Client, OpticalExam, Billing, OrderLineItem } from "@/lib/db/schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit, Trash2, Save, X } from "lucide-react"
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  );
}

interface EyeSectionProps {
  eye: "R" | "L";
  data: OrderEye;
  onChange: (eye: "R" | "L", field: keyof OrderEye, value: string) => void;
  isEditing: boolean;
}

function OrderEyeSection({ eye, data, onChange, isEditing }: EyeSectionProps) {
  const eyeLabel = eye === "R" ? "R" : "L";

  return (
    <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
      <div className="grid grid-cols-20 gap-4 flex-1 pb-2" dir="ltr">
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-sph`} className="text-[12px] block text-center">SPH</Label>}
          <Input id={`${eye}-sph`} type="number" step="0.25" value={data.sph?.toString() || ""} onChange={(e) => onChange(eye, "sph", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-cyl`} className="text-[12px] block text-center">CYL</Label>}
          <Input id={`${eye}-cyl`} type="number" step="0.25" value={data.cyl?.toString() || ""} onChange={(e) => onChange(eye, "cyl", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-ax`} className="text-[12px] block text-center">AXIS</Label>}
          <Input id={`${eye}-ax`} type="number" min="0" max="180" value={data.ax?.toString() || ""} onChange={(e) => onChange(eye, "ax", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-pris`} className="text-[12px] block text-center">PRIS</Label>}
          <Input id={`${eye}-pris`} type="number" step="0.5" value={data.pris?.toString() || ""} onChange={(e) => onChange(eye, "pris", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-base`} className="text-[12px] block text-center">BASE</Label>}
          <Input id={`${eye}-base`} type="text" value={data.base || ""} onChange={(e) => onChange(eye, "base", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="BASE" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-va`} className="text-[12px] block text-center">VA</Label>}
          <div className="relative" dir="ltr">
            <Input id={`${eye}-va`} type="text" value={data.va || ""} onChange={(e) => onChange(eye, "va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="6" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-ad`} className="text-[12px] block text-center">ADD</Label>}
          <Input id={`${eye}-ad`} type="number" step="0.25" value={data.ad?.toString() || ""} onChange={(e) => onChange(eye, "ad", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.00" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-pd`} className="text-[12px] block text-center">PD</Label>}
          <Input id={`${eye}-pd`} type="number" step="0.5" value={data.pd?.toString() || ""} onChange={(e) => onChange(eye, "pd", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-high`} className="text-[12px] block text-center">HIGH</Label>}
          <Input id={`${eye}-high`} type="number" step="0.5" value={data.high?.toString() || ""} onChange={(e) => onChange(eye, "high", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          {eye === "R" && <Label htmlFor={`${eye}-diam`} className="text-[12px] block text-center">DIAM</Label>}
          <Input id={`${eye}-diam`} type="number" value={data.diam?.toString() || ""} onChange={(e) => onChange(eye, "diam", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0" />
        </div>
      </div>
      <span className={`text-md font-medium pr-2 flex items-center justify-center w-6 ${eyeLabel === "L" ? "pb-2" : "pt-2"}`}>{eyeLabel}</span>
    </div>
  );
}

function CombinedOrderFields({ order, onChange, isEditing }: { 
  order: Order, 
  onChange: (field: keyof Order, value: string) => void, 
  isEditing: boolean
}) {
  return (
    <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
      <div className="grid grid-cols-20 gap-4 flex-1" dir="ltr">
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2"></div>
        <div className="col-span-2">
          <div className="relative" dir="ltr">
            <Input type="text" value={order.comb_va?.toString() || ""} onChange={(e) => onChange("comb_va", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1 pl-6" placeholder="6" />
            <span className="absolute left-2 top-[53%] transform -translate-y-1/2 text-[14px] text-gray-500 pointer-events-none">6/</span>
          </div>
        </div>
        <div className="col-span-2"></div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={order.comb_pd?.toString() || ""} onChange={(e) => onChange("comb_pd", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2">
          <Input type="number" step="0.5" value={order.comb_high?.toString() || ""} onChange={(e) => onChange("comb_high", e.target.value)} disabled={!isEditing} className="h-8 text-xs px-1" placeholder="0.0" />
        </div>
        <div className="col-span-2"></div>
      </div>
      <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>
    </div>
  );
}

interface OrderDetailPageProps {
  mode?: 'view' | 'edit' | 'new';
  clientId?: string;
  orderId?: string;
  examId?: string;
  onSave?: (order: Order, rightEyeOrder: OrderEye, leftEyeOrder: OrderEye, orderLens: OrderLens, frame: Frame) => void;
  onCancel?: () => void;
}

export default function OrderDetailPage({ 
  mode = 'view', 
  clientId: propClientId, 
  orderId: propOrderId,
  examId: propExamId,
  onSave,
  onCancel 
}: OrderDetailPageProps = {}) {
  let routeClientId: string | undefined, routeOrderId: string | undefined;
  
  try {
    const params = useParams({ from: "/clients/$clientId/orders/$orderId" });
    routeClientId = params.clientId;
    routeOrderId = params.orderId;
  } catch {
    try {
      const params = useParams({ from: "/clients/$clientId/orders/new" });
      routeClientId = params.clientId;
    } catch {
      routeClientId = undefined;
      routeOrderId = undefined;
    }
  }
  
  const clientId = propClientId || routeClientId
  const orderId = propOrderId || routeOrderId
  
  const searchParams = new URLSearchParams(window.location.search);
  const examIdFromSearch = searchParams.get('examId');
  const examId = propExamId || examIdFromSearch || undefined;
  
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [exam, setExam] = useState<OpticalExam | null>(null)
  const [rightEyeOrder, setRightEyeOrder] = useState<OrderEye | null>(null)
  const [leftEyeOrder, setLeftEyeOrder] = useState<OrderEye | null>(null)
  const [orderLens, setOrderLens] = useState<OrderLens | null>(null)
  const [frame, setFrame] = useState<Frame | null>(null)
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [billing, setBilling] = useState<Billing | null>(null)
  const [orderLineItems, setOrderLineItems] = useState<OrderLineItem[]>([])
  const [deletedOrderLineItemIds, setDeletedOrderLineItemIds] = useState<number[]>([])
  
  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [formData, setFormData] = useState<Order>(() => {
    if (isNewMode) {
      return {
        order_date: new Date().toISOString().split('T')[0],
        type: '',
        dominant_eye: '',
        examiner_name: '',
        comb_va: undefined,
        comb_high: undefined,
        comb_pd: undefined
      } as Order
    }
    return {} as Order
  })
  const [rightEyeFormData, setRightEyeFormData] = useState<OrderEye>(isNewMode ? { order_id: 0, eye: 'R' } as OrderEye : {} as OrderEye)
  const [leftEyeFormData, setLeftEyeFormData] = useState<OrderEye>(isNewMode ? { order_id: 0, eye: 'L' } as OrderEye : {} as OrderEye)
  const [lensFormData, setLensFormData] = useState<OrderLens>(isNewMode ? { order_id: 0 } as OrderLens : {} as OrderLens)
  const [frameFormData, setFrameFormData] = useState<Frame>(isNewMode ? { order_id: 0 } as Frame : {} as Frame)
  const [orderDetailsFormData, setOrderDetailsFormData] = useState<OrderDetails>(isNewMode ? { order_id: 0 } as OrderDetails : {} as OrderDetails)
  const [billingFormData, setBillingFormData] = useState<Billing>(isNewMode ? {} as Billing : {} as Billing)
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        if (clientId) {
          const clientData = await getClientById(Number(clientId))
          setClient(clientData || null)
        }
        
        if (orderId) {
          const orderData = await getOrderById(Number(orderId))
          setOrder(orderData || null)
          
          if (orderData) {
            const [orderEyesData, orderLensData, frameData, orderDetailsData, billingData] = await Promise.all([
              getOrderEyesByOrderId(Number(orderId)),
              getOrderLensByOrderId(Number(orderId)),
              getFrameByOrderId(Number(orderId)),
              getOrderDetailsByOrderId(Number(orderId)),
              getBillingByOrderId(Number(orderId))
            ])
            
            const rightEye = orderEyesData.find(e => e.eye === "R")
            const leftEye = orderEyesData.find(e => e.eye === "L")
            
            setRightEyeOrder(rightEye || null)
            setLeftEyeOrder(leftEye || null)
            setOrderLens(orderLensData || null)
            setFrame(frameData || null)
            setOrderDetails(orderDetailsData || null)
            setBilling(billingData || null)
            
            if (billingData && billingData.id) {
              const orderLineItemsData = await getOrderLineItemsByBillingId(billingData.id)
              setOrderLineItems(orderLineItemsData || [])
            }
          }
        } else if (examId) {
          const examData = await getExamById(Number(examId))
          setExam(examData || null)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [clientId, orderId, examId])
  
  useEffect(() => {
    if (order) {
      setFormData({ ...order })
    }
    if (rightEyeOrder) {
      setRightEyeFormData({ ...rightEyeOrder })
    }
    if (leftEyeOrder) {
      setLeftEyeFormData({ ...leftEyeOrder })
    }
    if (orderLens) {
      setLensFormData({ ...orderLens })
    }
    if (frame) {
      setFrameFormData({ ...frame })
    }
    if (orderDetails) {
      setOrderDetailsFormData({ ...orderDetails })
    }
    if (billing) {
      setBillingFormData({ ...billing })
    }
  }, [order, rightEyeOrder, leftEyeOrder, orderLens, frame, orderDetails, billing])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    const numericFields = ['comb_va', 'comb_high', 'comb_pd']
    if (numericFields.includes(name)) {
      const numValue = parseFloat(value)
      setFormData(prev => ({ ...prev, [name]: value === '' || isNaN(numValue) ? undefined : numValue }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleLensInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setLensFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFrameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    
    const numericFields = ['bridge', 'width', 'height', 'length']
    if (numericFields.includes(name)) {
      const numValue = parseFloat(value)
      setFrameFormData(prev => ({ ...prev, [name]: value === '' || isNaN(numValue) ? undefined : numValue }))
    } else {
      setFrameFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSelectChange = (value: string, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleLensSelectChange = (value: string, name: string) => {
    setLensFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFrameSelectChange = (value: string, name: string) => {
    setFrameFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEyeFieldChange = (
    eye: 'R' | 'L',
    field: keyof OrderEye,
    rawValue: string
  ) => {
    let processedValue: string | number | undefined = rawValue;
  
    const numericFields: (keyof OrderEye)[] = [
      "sph", "cyl", "ax", "pris", "ad", "diam", "s_base", "high", "pd"
    ];
    const integerFields: (keyof OrderEye)[] = ["ax", "diam"];
  
    if (numericFields.includes(field)) {
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
  
  const handleOrderFieldChange = (field: keyof Order, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;
    
    const numericFields: (keyof Order)[] = [
      "comb_va", "comb_high", "comb_pd"
    ];
    
    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    }
    
    setFormData(prev => ({ ...prev, [field]: processedValue }));
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
      toast.error("אנא בחר סוג הזמנה")
      return
    }
    
    try {
      if (isNewMode) {
        console.log('Creating new order...')
        
        const newOrder = await createOrder({
          order_date: formData.order_date,
          type: formData.type,
          dominant_eye: formData.dominant_eye,
          examiner_name: formData.examiner_name,
          comb_va: formData.comb_va,
          comb_high: formData.comb_high,
          comb_pd: formData.comb_pd
        })
        
        if (newOrder && newOrder.id) {
          const [newRightEyeOrder, newLeftEyeOrder, newOrderLens, newFrame, newOrderDetails] = await Promise.all([
            createOrderEye({
              ...rightEyeFormData,
              order_id: newOrder.id,
              eye: 'R',
            }),
            createOrderEye({
              ...leftEyeFormData,
              order_id: newOrder.id,
              eye: 'L',
            }),
            createOrderLens({
              ...lensFormData,
              order_id: newOrder.id,
            }),
            createFrame({
              ...frameFormData,
              order_id: newOrder.id,
            }),
            createOrderDetails({
              ...orderDetailsFormData,
              order_id: newOrder.id,
            })
          ])
          
          let newBilling: Billing | null = null
          let savedOrderLineItems: OrderLineItem[] = []
          
          console.log('New order - Billing form data:', billingFormData)
          console.log('New order - Order line items:', orderLineItems)
          
          const hasBillingData = Object.values(billingFormData).some(value => 
            value !== undefined && value !== null && value !== ''
          );
          
          if (hasBillingData || orderLineItems.length > 0) {
            console.log('Creating billing for new order...')
            newBilling = await createBilling({
              ...billingFormData,
              order_id: newOrder.id,
            })
            
            console.log('Created billing:', newBilling)
            
            if (newBilling && newBilling.id && orderLineItems.length > 0) {
              console.log('Creating line items for new order...')
              savedOrderLineItems = await Promise.all(
                orderLineItems.map(item => {
                  console.log('Creating line item:', item)
                  const { id, ...itemWithoutId } = item;
                  return createOrderLineItem({
                    ...itemWithoutId,
                    billings_id: newBilling!.id!
                  })
                })
              ).then(results => results.filter(Boolean) as OrderLineItem[])
              console.log('Saved line items:', savedOrderLineItems)
            }
          }
          
          if (newRightEyeOrder && newLeftEyeOrder && newOrderLens && newFrame && newOrderDetails) {
            toast.success("הזמנה חדשה נוצרה בהצלחה")
            if (onSave) {
              onSave(newOrder, newRightEyeOrder, newLeftEyeOrder, newOrderLens, newFrame)
            }
          } else {
            toast.error("לא הצלחנו ליצור את נתוני ההזמנה")
          }
        } else {
          toast.error("לא הצלחנו ליצור את ההזמנה")
        }
      } else {
        const [updatedOrder, updatedRightEyeOrder, updatedLeftEyeOrder, updatedOrderLens, updatedFrame, updatedOrderDetails] = await Promise.all([
          updateOrder(formData),
          updateOrderEye(rightEyeFormData),
          updateOrderEye(leftEyeFormData),
          updateOrderLens(lensFormData),
          updateFrame(frameFormData),
          orderDetailsFormData.id ? updateOrderDetails(orderDetailsFormData) : createOrderDetails({
            ...orderDetailsFormData,
            order_id: formData.id!
          })
        ])
        
        let updatedBilling: Billing | null = null
        console.log('Billing form data:', billingFormData)
        console.log('Order line items:', orderLineItems)
        
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
            order_id: formData.id!
          })
          updatedBilling = billingResult || null
        }
        
        console.log('Updated billing:', updatedBilling)
        
        if (updatedBilling && updatedBilling.id) {
          console.log('Processing line items...')
          // Delete removed order line items
          if (deletedOrderLineItemIds.length > 0) {
            console.log('Deleting line items:', deletedOrderLineItemIds)
            await Promise.all(
              deletedOrderLineItemIds.map(id => deleteOrderLineItem(id))
            )
            setDeletedOrderLineItemIds([])
          }
          
          // Update or create existing order line items
          const lineItemResults = await Promise.all(
            orderLineItems.map(async (item) => {
              if (item.id && item.id > 0) {
                // Existing database record - update it
                console.log('Updating line item:', item.id)
                return updateOrderLineItem({
                  ...item,
                  billings_id: updatedBilling.id!
                })
              } else {
                // New item (has negative temp ID or no ID) - create it
                console.log('Creating new line item:', item)
                const { id, ...itemWithoutId } = item;
                return createOrderLineItem({
                  ...itemWithoutId,
                  billings_id: updatedBilling.id!
                })
              }
            })
          )
          console.log('Line item results:', lineItemResults)
        }
        
        if (updatedOrder && updatedRightEyeOrder && updatedLeftEyeOrder && updatedOrderLens && updatedFrame && updatedOrderDetails) {
          setIsEditing(false)
          setOrder(updatedOrder)
          setRightEyeOrder(updatedRightEyeOrder)
          setLeftEyeOrder(updatedLeftEyeOrder)
          setOrderLens(updatedOrderLens)
          setFrame(updatedFrame)
          setOrderDetails(updatedOrderDetails)
          if (updatedBilling) {
            setBilling(updatedBilling)
          }
          setFormData({ ...updatedOrder })
          setRightEyeFormData({ ...updatedRightEyeOrder })
          setLeftEyeFormData({ ...updatedLeftEyeOrder })
          setLensFormData({ ...updatedOrderLens })
          setFrameFormData({ ...updatedFrame })
          setOrderDetailsFormData({ ...updatedOrderDetails })
          if (updatedBilling) {
            setBillingFormData({ ...updatedBilling })
          }
          toast.success("פרטי ההזמנה עודכנו בהצלחה")
          if (onSave) {
            onSave(updatedOrder, updatedRightEyeOrder, updatedLeftEyeOrder, updatedOrderLens, updatedFrame)
          }
        } else {
          toast.error("לא הצלחנו לשמור את השינויים")
        }
      }
    } catch (error) {
      console.error('Error saving order:', error)
      toast.error("שגיאה בשמירת ההזמנה")
    }
  }
  
  if (loading) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="לקוחות" backLink="/clients" />
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl">טוען...</h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }
  
  if (!client || (!isNewMode && (!order || !rightEyeOrder || !leftEyeOrder))) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="לקוחות" backLink="/clients" />
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl">{isNewMode ? "לקוח לא נמצא" : "הזמנה לא נמצאה"}</h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
          <SidebarProvider dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <AppSidebar variant="inset" side="right" />
        <SidebarInset style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          clientName={fullName}
          clientBackLink={`/clients/${clientId}`}
          examInfo={isNewMode ? "הזמנה חדשה" : `הזמנה מס' ${orderId}`}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10" dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
          <Tabs defaultValue="order" className="w-full" dir="rtl">
            <div className="flex justify-between items-center mb-4">
              <TabsList className="grid grid-cols-2 w-auto">
                <TabsTrigger value="order">הזמנה</TabsTrigger>
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
                  {isNewMode ? "שמור הזמנה" : (isEditing ? "שמור שינויים" : "ערוך הזמנה")}
                </Button>
              </div>
            </div>
            
            <TabsContent value="order" className="space-y-4">
              <form ref={formRef} className="pt-4 pb-10" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
                <div className="grid grid-cols-1 gap-4">
              <div className="rounded-md">
                <div className="grid grid-cols-5 gap-x-3 gap-y-2">
                  <div className="col-span-1">
                    <label className="font-semibold text-base">תאריך הזמנה</label>
                    <DateInput
                      name="order_date"
                      className="h-9"
                      value={formData.order_date}
                      onChange={handleInputChange}
                      disabled={!isEditing}
                    />
                  </div>
                                    <div className="col-span-1">
                    <label className="font-semibold text-base">סוג הזמנה</label>
                    <div className="h-1"></div>
                    <Select dir="rtl"
                      disabled={!isEditing}
                      value={formData.type || ''} 
                      onValueChange={(value) => handleSelectChange(value, 'type')}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="בחר סוג" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="משקפי ראייה" className="text-sm">משקפי ראייה</SelectItem>
                        <SelectItem value="משקפי קריאה" className="text-sm">משקפי קריאה</SelectItem>
                        <SelectItem value="משקפי שמש" className="text-sm">משקפי שמש</SelectItem>
                        <SelectItem value="משקפי מולטיפוקל" className="text-sm">משקפי מולטיפוקל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-1">
                    <label className="font-semibold text-base">עין דומיננטית</label>
                    <div className="h-1"></div>
                    <Select dir="rtl"
                      disabled={!isEditing}
                      value={formData.dominant_eye || ''} 
                      onValueChange={(value) => handleSelectChange(value, 'dominant_eye')}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="בחר עין" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="R" className="text-sm">ימין (R)</SelectItem>
                        <SelectItem value="L" className="text-sm">שמאל (L)</SelectItem>
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
                      onChange={handleInputChange}
                      disabled={!isEditing}
                      className="text-sm h-9"
                      placeholder="שם הבוחן"
                    />
                  </div>
 
                  <div className="col-span-1">
                    <label className="font-semibold text-base">PD כללי</label>
                    <div className="h-1"></div>
                    <Input 
                      type="number"
                      step="0.5"
                      name="comb_pd"
                      value={formData.comb_pd || ''}
                      onChange={handleInputChange}
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
                      נתוני עיניים
                    </div>
                  </div>
                  <OrderEyeSection eye="R" data={rightEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                  <CombinedOrderFields order={formData} onChange={handleOrderFieldChange} isEditing={isEditing} />
                  <OrderEyeSection eye="L" data={leftEyeFormData} onChange={handleEyeFieldChange} isEditing={isEditing} />
                </CardContent>
              </Card>

              <Tabs defaultValue="prescription" className="w-full" dir="rtl">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="prescription">מרשם</TabsTrigger>
                  <TabsTrigger value="order">הזמנה</TabsTrigger>
                  <TabsTrigger value="notes">הערות</TabsTrigger>
                </TabsList>
                
                <TabsContent value="prescription" className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader >
                        <CardTitle className="text-base">פרטי עדשות</CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm">דגם עדשה ימין</Label>
                          <Input
                            name="right_model"
                            value={lensFormData.right_model || ''}
                            onChange={handleLensInputChange}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">דגם עדשה שמאל</Label>
                          <Input
                            name="left_model"
                            value={lensFormData.left_model || ''}
                            onChange={handleLensInputChange}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">צבע</Label>
                          <Input
                            name="color"
                            value={lensFormData.color || ''}
                            onChange={handleLensInputChange}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">ציפוי</Label>
                          <Input
                            name="coating"
                            value={lensFormData.coating || ''}
                            onChange={handleLensInputChange}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">חומר</Label>
                          <Input
                            name="material"
                            value={lensFormData.material || ''}
                            onChange={handleLensInputChange}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">ספק</Label>
                          <Input
                            name="supplier"
                            value={lensFormData.supplier || ''}
                            onChange={handleLensInputChange}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader >
                        <CardTitle className="text-base">פרטי מסגרת</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">יצרן</Label>
                            <Input
                              name="manufacturer"
                              value={frameFormData.manufacturer || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">דגם</Label>
                            <Input
                              name="model"
                              value={frameFormData.model || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm">צבע</Label>
                            <Input
                              name="color"
                              value={frameFormData.color || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">ספק</Label>
                            <Input
                              name="supplier"
                              value={frameFormData.supplier || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-5 gap-3">
                          <div>
                            <Label className="text-sm">סופק על ידי</Label>
                            <Select dir="rtl"
                                disabled={!isEditing}
                              value={frameFormData.supplied_by || ''} 
                              onValueChange={(value) => handleFrameSelectChange(value, 'supplied_by')}
                            >
                              <SelectTrigger className="mt-1.5">
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
                              value={frameFormData.bridge || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">רוחב</Label>
                            <Input
                              name="width"
                              type="number"
                              value={frameFormData.width || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">גובה</Label>
                            <Input
                              name="height"
                              type="number"
                              value={frameFormData.height || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm">אורך זרוע</Label>
                            <Input
                              name="length"
                              type="number"
                              value={frameFormData.length || ''}
                              onChange={handleFrameInputChange}
                              disabled={!isEditing}
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="order" className="space-y-4">
                  <Card>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-5 gap-3">
                        <div>
                          <Label className="text-sm">סניף</Label>
                          <Input
                            name="branch"
                            value={orderDetailsFormData.branch || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, branch: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">סטטוס ספק</Label>
                          <Input
                            name="supplier_status"
                            value={orderDetailsFormData.supplier_status || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, supplier_status: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">מספר שקית</Label>
                          <Input
                            name="bag_number"
                            value={orderDetailsFormData.bag_number || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, bag_number: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">יועץ</Label>
                          <Input
                            name="advisor"
                            value={orderDetailsFormData.advisor || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, advisor: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">מוסר</Label>
                          <Input
                            name="delivered_by"
                            value={orderDetailsFormData.delivered_by || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, delivered_by: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-5 gap-3">
                        <div>
                          <Label className="text-sm">טכני</Label>
                          <Input
                            name="technician"
                            value={orderDetailsFormData.technician || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, technician: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">אספקה בסניף</Label>
                          <Input
                            name="delivery_location"
                            value={orderDetailsFormData.delivery_location || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, delivery_location: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">מעבדה מייצרת</Label>
                          <Input
                            name="manufacturing_lab"
                            value={orderDetailsFormData.manufacturing_lab || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, manufacturing_lab: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">סטטוס הזמנה</Label>
                          <Select dir="rtl"
                            disabled={!isEditing}
                            value={orderDetailsFormData.order_status || ''} 
                            onValueChange={(value) => setOrderDetailsFormData(prev => ({ ...prev, order_status: value }))}
                          >
                            <SelectTrigger className="mt-1.5 h-9 w-full">
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
                          <Select dir="rtl"
                            disabled={!isEditing}
                            value={orderDetailsFormData.priority || ''} 
                            onValueChange={(value) => setOrderDetailsFormData(prev => ({ ...prev, priority: value }))}
                          >
                            <SelectTrigger className="mt-1.5 h-9 w-full">
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
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, delivered_at: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">תאריך תום אחריות</Label>
                          <DateInput
                            name="warranty_expiration"
                            value={orderDetailsFormData.warranty_expiration}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, warranty_expiration: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">הובטח לתאריך</Label>
                          <DateInput
                            name="promised_date"
                            value={orderDetailsFormData.promised_date}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, promised_date: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">תאריך אישור</Label>
                          <DateInput
                            name="approval_date"
                            value={orderDetailsFormData.approval_date}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, approval_date: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5"
                          />
                        </div>
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
                            value={orderDetailsFormData.notes || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, notes: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5 min-h-[100px]"
                            placeholder="הכנס הערות כלליות..."
                          />
                        </div>
                        <div>
                          <Label className="text-sm">הערות להזמנת עדשות</Label>
                          <Textarea
                            name="lens_order_notes"
                            value={orderDetailsFormData.lens_order_notes || ''}
                            onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, lens_order_notes: e.target.value }))}
                            disabled={!isEditing}
                            className="mt-1.5 min-h-[100px]"
                            placeholder="הכנס הערות להזמנת עדשות..."
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