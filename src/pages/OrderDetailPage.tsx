import React, { useState, useRef, useEffect } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
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
import { Order, OrderEye, OrderLens, Frame, OrderDetails, Client, OpticalExam, Billing, OrderLineItem, User, FinalPrescriptionExam } from "@/lib/db/schema"
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
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"
import { getAllUsers } from "@/lib/db/users-db"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { LookupSelect } from "@/components/ui/lookup-select"
import { FinalPrescriptionTab } from "@/components/exam/FinalPrescriptionTab"
import { ExamToolbox, createToolboxActions } from "@/components/exam/ExamToolbox"
import { ExamFieldMapper, ExamComponentType } from "@/lib/exam-field-mappings"
import { copyToClipboard, pasteFromClipboard, getClipboardContentType } from "@/lib/exam-clipboard"
import { getFinalPrescriptionExamByOrderId, createFinalPrescriptionExam, updateFinalPrescriptionExam } from "@/lib/db/final-prescription-db"
import { DateInput } from "@/components/ui/date"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"

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
  const [users, setUsers] = useState<User[]>([])
  const [finalPrescription, setFinalPrescription] = useState<FinalPrescriptionExam | null>(null)
  const { currentUser } = useUser()
  const { currentClient } = useClientSidebar()
  
  const isNewMode = mode === 'new'
  const [isEditing, setIsEditing] = useState(isNewMode)
  const [activeTab, setActiveTab] = useState('orders')
  const [formData, setFormData] = useState<Order>(() => {
    if (isNewMode) {
      return {
        client_id: Number(clientId),
        order_date: new Date().toISOString().split('T')[0],
        type: '',
        dominant_eye: '',
        user_id: currentUser?.id,
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
  const [finalPrescriptionFormData, setFinalPrescriptionFormData] = useState<FinalPrescriptionExam>(isNewMode ? { order_id: 0 } as FinalPrescriptionExam : {} as FinalPrescriptionExam)
  
  const type: ExamComponentType = 'final-prescription'
  const examFormData = { [type]: finalPrescriptionFormData }
  const fieldHandlers = { [type]: (field: string, value: string) => handleFinalPrescriptionChange(field as keyof FinalPrescriptionExam, value) }
  const toolboxActions = createToolboxActions(examFormData, fieldHandlers)
  const [clipboardSourceType, setClipboardSourceType] = useState<ExamComponentType | null>(null)

  useEffect(() => {
    setClipboardSourceType(getClipboardContentType())
  }, [])

  const currentCard = { id: 'final-prescription', type }
  const allRows = [[currentCard]]

  const handleCopy = () => {
    copyToClipboard(type, finalPrescriptionFormData)
    setClipboardSourceType(type)
    toast.success("נתוני המרשם הועתקו")
  }

  const handlePaste = () => {
    const clipboardContent = pasteFromClipboard()
    if (!clipboardContent) {
      toast.error("אין נתונים בלוח ההעתקה")
      return
    }

    const { type: sourceType, data: sourceData } = clipboardContent
    const isCompatible = sourceType === type || ExamFieldMapper.getAvailableTargets(sourceType, [type]).includes(type)

    if (!isCompatible) {
      toast.error("נתונים לא תואמים")
      return
    }

    const copiedData = ExamFieldMapper.copyData(sourceData, finalPrescriptionFormData, sourceType, type)

    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        handleFinalPrescriptionChange(key as keyof FinalPrescriptionExam, String(value))
      }
    })

    toast.success("נתונים הודבקו בהצלחה")
  }
  
  const formRef = useRef<HTMLFormElement>(null)
  const navigate = useNavigate()
  
  const handleTabChange = (value: string) => {
    if (clientId && value !== 'orders') {
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
        
        if (orderId) {
          const orderData = await getOrderById(Number(orderId))
          setOrder(orderData || null)
          
          if (orderData) {
            const [orderEyesData, orderLensData, frameData, orderDetailsData, billingData, finalPrescriptionData] = await Promise.all([
              getOrderEyesByOrderId(Number(orderId)),
              getOrderLensByOrderId(Number(orderId)),
              getFrameByOrderId(Number(orderId)),
              getOrderDetailsByOrderId(Number(orderId)),
              getBillingByOrderId(Number(orderId)),
              getFinalPrescriptionExamByOrderId(Number(orderId))
            ])
            
            const rightEye = orderEyesData.find(e => e.eye === "R")
            const leftEye = orderEyesData.find(e => e.eye === "L")
            
            setRightEyeOrder(rightEye || null)
            setLeftEyeOrder(leftEye || null)
            setOrderLens(orderLensData || null)
            setFrame(frameData || null)
            setOrderDetails(orderDetailsData || null)
            setBilling(billingData || null)
            setFinalPrescription(finalPrescriptionData || null)
            
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
    if (finalPrescription) {
      setFinalPrescriptionFormData({ ...finalPrescription })
    }
  }, [order, rightEyeOrder, leftEyeOrder, orderLens, frame, orderDetails, billing, finalPrescription])

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

  const handleFinalPrescriptionChange = (field: keyof FinalPrescriptionExam, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;

    const numericFields: (keyof FinalPrescriptionExam)[] = [
      "r_sph", "l_sph", "r_cyl", "l_cyl", "r_ax", "l_ax", "r_pris", "l_pris",
      "r_va", "l_va", "r_ad", "l_ad", "r_pd", "l_pd", "r_high", "l_high",
      "r_diam", "l_diam", "comb_va", "comb_pd", "comb_high"
    ];
    const integerFields: (keyof FinalPrescriptionExam)[] = ["r_ax", "l_ax"];

    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (integerFields.includes(field)) {
      const val = parseInt(rawValue, 10);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    } else if (rawValue === "") {
      processedValue = undefined;
    }

    setFinalPrescriptionFormData(prev => ({ ...prev, [field]: processedValue }));
  };



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
          client_id: Number(clientId),
          order_date: formData.order_date,
          type: formData.type,
          dominant_eye: formData.dominant_eye,
          user_id: formData.user_id,
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

          // Create final prescription if it has data
          let newFinalPrescription: FinalPrescriptionExam | null = null
          const hasFinalPrescriptionData = Object.values(finalPrescriptionFormData).some(value => 
            value !== undefined && value !== null && value !== '' && value !== 0
          );
          
          if (hasFinalPrescriptionData) {
            newFinalPrescription = await createFinalPrescriptionExam({
              ...finalPrescriptionFormData,
              order_id: newOrder.id,
            })
          }
          
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

        // Handle final prescription
        let updatedFinalPrescription: FinalPrescriptionExam | null = null
        const hasFinalPrescriptionData = Object.values(finalPrescriptionFormData).some(value => 
          value !== undefined && value !== null && value !== '' && value !== 0
        );

        if (finalPrescriptionFormData.id) {
          // Update existing final prescription
          updatedFinalPrescription = await updateFinalPrescriptionExam(finalPrescriptionFormData)
        } else if (hasFinalPrescriptionData) {
          // Create new final prescription
          updatedFinalPrescription = await createFinalPrescriptionExam({
            ...finalPrescriptionFormData,
            order_id: formData.id!
          })
        }
        
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
          if (updatedFinalPrescription) {
            setFinalPrescription(updatedFinalPrescription)
            setFinalPrescriptionFormData({ ...updatedFinalPrescription })
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
  
  if (loading || !currentClient) {
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
  
  if (!isNewMode && !order) {
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
          <h1 className="text-2xl">{isNewMode ? "לקוח לא נמצא" : "הזמנה לא נמצאה"}</h1>
        </div>
      </>
    )
  }

  const fullName = `${currentClient?.first_name} ${currentClient?.last_name}`.trim()
  
  return (
      <>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          clientBackLink={`/clients/${clientId}`}
          examInfo={isNewMode ? "הזמנה חדשה" : `הזמנה מס' ${orderId}`}
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <ClientSpaceLayout>
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
                <Card className="w-full p-4 shadow-md border-none">
                  <div className="grid grid-cols-4 gap-x-3 gap-y-2 w-full" dir="rtl">
                    <div className="col-span-1">
                      <label className="font-semibold text-base">תאריך הזמנה</label>
                      <div className="h-1"></div>
                      <DateInput
                        name="order_date"
                        className={`px-14 h-9 ${isEditing ? 'bg-white' : 'bg-accent/50'}`}
                        value={formData.order_date}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                      />
                    </div>
                    
                    <div className="col-span-1">
                      <label className="font-semibold text-base">סוג הזמנה</label>
                      <div className="h-1"></div>
                      {isEditing ? (
                        <LookupSelect
                          value={formData.type || ''}
                          onChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                          lookupType="orderType"
                          placeholder="בחר או הקלד סוג הזמנה..."
                          className="h-9 bg-white"
                        />
                      ) : (
                        <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">
                          {formData.type || 'לא נבחר'}
                        </div>
                      )}
                    </div>
                    
                    <div className="col-span-1">
                      <label className="font-semibold text-base">עין דומיננטית</label>
                      <div className="h-1"></div>
                      <Select dir="rtl"
                        disabled={!isEditing}
                        value={formData.dominant_eye || ''} 
                        onValueChange={(value) => handleSelectChange(value, 'dominant_eye')}
                      >
                        <SelectTrigger className={`h-9 text-sm w-full ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
                          <SelectValue placeholder="בחר עין" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="R" className="text-sm">ימין</SelectItem>
                          <SelectItem value="L" className="text-sm">שמאל</SelectItem>
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
                        <div className="border h-9 px-3 rounded-md text-sm flex items-center bg-accent/50">
                          {formData.user_id ? (
                            users.find(u => u.id === formData.user_id)?.username || 'משתמש לא נמצא'
                          ) : 'לא נבחר בודק'}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
                
                <div className="relative h-full">
  {isEditing && (
    <ExamToolbox
      isEditing={isEditing}
      mode='detail'
      currentCard={currentCard}
      allRows={allRows}
      currentRowIndex={0}
      currentCardIndex={0}
      clipboardSourceType={clipboardSourceType}
      onClearData={() => toolboxActions.clearData(type)}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onCopyLeft={() => {}}
      onCopyRight={() => {}}
      onCopyBelow={() => {}}
    />
  )}
  <FinalPrescriptionTab
    finalPrescriptionData={finalPrescriptionFormData}
    onFinalPrescriptionChange={handleFinalPrescriptionChange}
    isEditing={isEditing}
    hideEyeLabels={false}
  />
</div>


                <div className="flex gap-6">
                  <div className="flex-1">
                    <Tabs defaultValue="prescription" className="w-full" dir="rtl" orientation="vertical">
                      <div className="flex gap-6">
                        <TabsList className="flex flex-col h-fit w-28 p-1 bg-cyan-800/10 dark:bg-card/50">
                          <TabsTrigger value="prescription" className="w-full justify-end text-right">
                            <div className="text-right w-full">
                              <div className="flex items-center justify-start gap-1">
                                <span className="font-medium">מרשם</span>
                              </div>
                            </div>
                          </TabsTrigger>
                          <TabsTrigger value="order" className="w-full justify-end text-right">
                            <div className="text-right w-full">
                              <div className="flex items-center justify-start gap-1">
                                <span className="font-medium">הזמנה</span>
                              </div>
                            </div>
                          </TabsTrigger>
                          <TabsTrigger value="notes" className="w-full justify-end text-right">
                            <div className="text-right w-full">
                              <div className="flex items-center justify-start gap-1">
                                <span className="font-medium">הערות</span>
                              </div>
                            </div>
                          </TabsTrigger>
                        </TabsList>
                        
                        <div className="flex-1">
                          <TabsContent value="prescription" className="space-y-4 mt-0">
                            <div className="grid grid-cols-2 gap-6">
                              <Card className="shadow-md border-none">
                                <CardHeader >
                                  <CardTitle className="text-base">פרטי עדשות</CardTitle>
                                  <p className="text-sm text-muted-foreground">מידע על סוג העדשות, צבע, ציפוי וחומר</p>
                                </CardHeader>
                                <CardContent className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-sm">דגם עדשה ימין</Label>
                                    <LookupSelect
                                      value={lensFormData.right_model || ''}
                                      onChange={(value) => setLensFormData(prev => ({ ...prev, right_model: value }))}
                                      lookupType="lensModel"
                                      placeholder="בחר או הקלד דגם עדשה..."
                                      disabled={!isEditing}
                                      className="mt-1.5"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">דגם עדשה שמאל</Label>
                                    <LookupSelect
                                      value={lensFormData.left_model || ''}
                                      onChange={(value) => setLensFormData(prev => ({ ...prev, left_model: value }))}
                                      lookupType="lensModel"
                                      placeholder="בחר או הקלד דגם עדשה..."
                                      disabled={!isEditing}
                                      className="mt-1.5"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">צבע</Label>
                                    <LookupSelect
                                      value={lensFormData.color || ''}
                                      onChange={(value) => setLensFormData(prev => ({ ...prev, color: value }))}
                                      lookupType="color"
                                      placeholder="בחר או הקלד צבע..."
                                      disabled={!isEditing}
                                      className="mt-1.5"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">ציפוי</Label>
                                    <LookupSelect
                                      value={lensFormData.coating || ''}
                                      onChange={(value) => setLensFormData(prev => ({ ...prev, coating: value }))}
                                      lookupType="coating"
                                      placeholder="בחר או הקלד ציפוי..."
                                      disabled={!isEditing}
                                      className="mt-1.5"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">חומר</Label>
                                    <LookupSelect
                                      value={lensFormData.material || ''}
                                      onChange={(value) => setLensFormData(prev => ({ ...prev, material: value }))}
                                      lookupType="material"
                                      placeholder="בחר או הקלד חומר..."
                                      disabled={!isEditing}
                                      className="mt-1.5"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">ספק</Label>
                                    <LookupSelect
                                      value={lensFormData.supplier || ''}
                                      onChange={(value) => setLensFormData(prev => ({ ...prev, supplier: value }))}
                                      lookupType="supplier"
                                      placeholder="בחר או הקלד ספק..."
                                      disabled={!isEditing}
                                      className="mt-1.5"
                                    />
                                  </div>
                                </CardContent>
                              </Card>

                              <Card className="shadow-md border-none">
                                <CardHeader >
                                  <CardTitle className="text-base">פרטי מסגרת</CardTitle>
                                  <p className="text-sm text-muted-foreground">מידע על יצרן, דגם, מידות וספק המסגרת</p>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-sm">יצרן</Label>
                                      <LookupSelect
                                        value={frameFormData.manufacturer || ''}
                                        onChange={(value) => setFrameFormData(prev => ({ ...prev, manufacturer: value }))}
                                        lookupType="manufacturer"
                                        placeholder="בחר או הקלד יצרן..."
                                        disabled={!isEditing}
                                        className="mt-1.5"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">דגם</Label>
                                      <LookupSelect
                                        value={frameFormData.model || ''}
                                        onChange={(value) => setFrameFormData(prev => ({ ...prev, model: value }))}
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
                                        value={frameFormData.color || ''}
                                        onChange={(value) => setFrameFormData(prev => ({ ...prev, color: value }))}
                                        lookupType="color"
                                        placeholder="בחר או הקלד צבע..."
                                        disabled={!isEditing}
                                        className="mt-1.5"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-sm">ספק</Label>
                                      <LookupSelect
                                        value={frameFormData.supplier || ''}
                                        onChange={(value) => setFrameFormData(prev => ({ ...prev, supplier: value }))}
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
                                      <Select dir="rtl"
                                          disabled={!isEditing}
                                        value={frameFormData.supplied_by || ''} 
                                        onValueChange={(value) => handleFrameSelectChange(value, 'supplied_by')}
                                      >
                                        <SelectTrigger className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
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
                                        className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                                        className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                                        className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                                        className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                      />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </TabsContent>
                          
                          <TabsContent value="order" className="space-y-4 mt-0">
                            <Card className="shadow-md border-none">
                              <CardContent className="space-y-3">
                                <div className="grid grid-cols-5 gap-3">
                                  <div>
                                    <Label className="text-sm">סניף</Label>
                                    <LookupSelect
                                      value={orderDetailsFormData.branch || ''}
                                      onChange={(value) => setOrderDetailsFormData(prev => ({ ...prev, branch: value }))}
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
                                      value={orderDetailsFormData.supplier_status || ''}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, supplier_status: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">מספר שקית</Label>
                                    <Input
                                      name="bag_number"
                                      value={orderDetailsFormData.bag_number || ''}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, bag_number: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">יועץ</Label>
                                    <LookupSelect
                                      value={orderDetailsFormData.advisor || ''}
                                      onChange={(value) => setOrderDetailsFormData(prev => ({ ...prev, advisor: value }))}
                                      lookupType="advisor"
                                      placeholder="בחר או הקלד יועץ..."
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">מוסר</Label>
                                    <Input
                                      name="delivered_by"
                                      value={orderDetailsFormData.delivered_by || ''}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, delivered_by: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">אספקה בסניף</Label>
                                    <Input
                                      name="delivery_location"
                                      value={orderDetailsFormData.delivery_location || ''}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, delivery_location: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">מעבדה מייצרת</Label>
                                    <LookupSelect
                                      value={orderDetailsFormData.manufacturing_lab || ''}
                                      onChange={(value) => setOrderDetailsFormData(prev => ({ ...prev, manufacturing_lab: value }))}
                                      lookupType="manufacturingLab"
                                      placeholder="בחר או הקלד מעבדה..."
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
                                      <SelectTrigger className={`mt-1.5 h-9 w-full ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
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
                                      <SelectTrigger className={`mt-1.5 h-9 w-full ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
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
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">תאריך תום אחריות</Label>
                                    <DateInput
                                      name="warranty_expiration"
                                      value={orderDetailsFormData.warranty_expiration}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, warranty_expiration: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">הובטח לתאריך</Label>
                                    <DateInput
                                      name="promised_date"
                                      value={orderDetailsFormData.promised_date}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, promised_date: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-sm">תאריך אישור</Label>
                                    <DateInput
                                      name="approval_date"
                                      value={orderDetailsFormData.approval_date}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, approval_date: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                    />
                                  </div>
                                  <div></div>
                                </div>
                              </CardContent>
                            </Card>
                          </TabsContent>
                          
                          <TabsContent value="notes" className="space-y-4 mt-0">
                            <Card className="shadow-md border-none">
                              <CardContent className="">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label className="text-sm">הערות</Label>
                                    <Textarea
                                      name="notes"
                                      value={orderDetailsFormData.notes || ''}
                                      onChange={(e) => setOrderDetailsFormData(prev => ({ ...prev, notes: e.target.value }))}
                                      disabled={!isEditing}
                                      className={`mt-1.5 min-h-[100px] ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
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
                                      className={`mt-1.5 min-h-[100px] ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                                      placeholder="הכנס הערות להזמנת עדשות..."
                                    />
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </TabsContent>
                        </div>
                      </div>
                    </Tabs>
                  </div>
                </div>
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
        </ClientSpaceLayout>
      </>
    )
} 