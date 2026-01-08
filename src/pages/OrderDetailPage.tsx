import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearch, useBlocker } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { getExamById } from "@/lib/db/exams-db";
import {
  getOrderById,
  upsertOrderFull,
  upsertContactLensOrderFull,
  getContactLensOrderById,
} from "@/lib/db/orders-db";
import {
  getBillingByOrderId,
  getOrderLineItemsByBillingId,
  getBillingByContactLensId,
} from "@/lib/db/billing-db";
import {
  Order,
  OpticalExam,
  Billing,
  OrderLineItem,
  User,
  FinalPrescriptionExam,
} from "@/lib/db/schema-interface";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Loader2, Save, Edit } from "lucide-react";
import { BillingTab } from "@/components/BillingTab";
import { useUser } from "@/contexts/UserContext";
import { getAllUsers } from "@/lib/db/users-db";
import {
  ExamToolbox,
  createToolboxActions,
} from "@/components/exam/ExamToolbox";
import { ExamFieldMapper, ExamComponentType } from "@/lib/exam-field-mappings";
import {
  copyToClipboard,
  pasteFromClipboard,
  getClipboardContentType,
} from "@/lib/exam-clipboard";
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout";
import { useClientSidebar } from "@/contexts/ClientSidebarContext";
import { Skeleton } from "@/components/ui/skeleton";
import RegularOrderTab from "@/components/orders/RegularOrderTab";
import ContactOrderTab from "@/components/orders/ContactOrderTab";
import { docxGenerator } from "@/lib/docx-generator";
import { OrderToDocxMapper } from "@/lib/order-to-docx-mapper";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useUnsavedChanges } from "@/hooks/shared/useUnsavedChanges";
import { UI_CONFIG } from "@/config/ui-config";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import { flushSync } from "react-dom";

interface OrderDetailPageProps {
  mode?: "view" | "edit" | "new";
  clientId?: string;
  orderId?: string;
  examId?: string;
  onSave?: (order: Order) => void;
  onCancel?: () => void;
}

export default function OrderDetailPage({
  mode = "view",
  clientId: propClientId,
  orderId: propOrderId,
  examId: propExamId,
  onSave,
  onCancel,
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

  const clientId = propClientId || routeClientId;
  const orderId = propOrderId || routeOrderId;

  let searchTypeParam: string | undefined,
    examIdFromSearch: string | null = null;
  try {
    const search = useSearch({ from: "/clients/$clientId/orders/$orderId" });
    searchTypeParam = search?.type as string | undefined;
    examIdFromSearch = (search?.examId as string | undefined) ?? null;
  } catch {
    try {
      const search = useSearch({ from: "/clients/$clientId/orders/new" });
      searchTypeParam = search?.type as string | undefined;
      examIdFromSearch = (search?.examId as string | undefined) ?? null;
    } catch {
      searchTypeParam = undefined;
      examIdFromSearch = null;
    }
  }
  const isContactMode = searchTypeParam === "contact";
  const examId = propExamId || examIdFromSearch || undefined;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [exam, setExam] = useState<OpticalExam | null>(null);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [orderLineItems, setOrderLineItems] = useState<OrderLineItem[]>([]);
  const [deletedOrderLineItemIds, setDeletedOrderLineItemIds] = useState<
    number[]
  >([]);

  // Debug wrapper for setOrderLineItems
  const setOrderLineItemsWithLogging = (
    value: OrderLineItem[] | ((prev: OrderLineItem[]) => OrderLineItem[])
  ) => {
    if (typeof value === "function") {
      setOrderLineItems((prev) => {
        const newValue = value(prev);
        console.log("Order line items updated (function):", {
          before: prev,
          after: newValue,
        });
        return newValue;
      });
    } else {
      console.log("Order line items updated (direct):", value);
      setOrderLineItems(value);
    }
  };
  const [users, setUsers] = useState<User[]>([]);
  const [finalPrescription, setFinalPrescription] =
    useState<FinalPrescriptionExam | null>(null);
  const { currentUser, currentClinic } = useUser();
  const { currentClient } = useClientSidebar();
  const [orderIdForData, setOrderIdForData] = useState<number | null>(null);

  const isNewMode = mode === "new";
  const [isEditing, setIsEditing] = useState(isNewMode);
  const [activeTab, setActiveTab] = useState("orders");

  const [contactFormData, setContactFormData] = useState<any>(() => {
    if (isNewMode && isContactMode) {
      return {
        client_id: Number(clientId),
        clinic_id: currentClinic?.id,
        order_date: new Date().toISOString().split("T")[0],
        type: "עדשות מגע",
        user_id: currentUser?.id,
        notes: "",
        supplier_notes: "",
      };
    }
    return {};
  });
  const [contactLensExamData, setContactLensExamData] = useState<any>({});
  const [contactLensDetailsData, setContactLensDetailsData] = useState<any>({});
  const [keratoCLData, setKeratoCLData] = useState<any>({});
  const [schirmerData, setSchirmerData] = useState<any>({});
  const [diametersData, setDiametersData] = useState<any>({});

  const [formData, setFormData] = useState<Order>(() => {
    if (isNewMode) {
      return {
        client_id: Number(clientId),
        order_date: new Date().toISOString().split("T")[0],
        type: "",
        dominant_eye: "",
        user_id: currentUser?.id,
        comb_va: undefined,
        comb_high: undefined,
        comb_pd: undefined,
      } as Order;
    }
    return {} as Order;
  });
  const [lensFormData, setLensFormData] = useState<OrderLens>(
    isNewMode ? ({ order_id: 0 } as OrderLens) : ({} as OrderLens),
  );
  const [frameFormData, setFrameFormData] = useState<Frame>(
    isNewMode ? ({ order_id: 0 } as Frame) : ({} as Frame),
  );
  const [orderDetailsFormData, setOrderDetailsFormData] =
    useState<OrderDetails>(
      isNewMode ? ({ order_id: 0 } as OrderDetails) : ({} as OrderDetails),
    );
  const [billingFormData, setBillingFormData] = useState<Billing>(
    isNewMode ? ({} as Billing) : ({} as Billing),
  );
  const [finalPrescriptionFormData, setFinalPrescriptionFormData] =
    useState<FinalPrescriptionExam>(
      isNewMode
        ? ({ order_id: 0 } as FinalPrescriptionExam)
        : ({} as FinalPrescriptionExam),
    );

  // Use refs to ensure handleSave (which is a stable callback) can access the 
  // MOST RECENT data even after calling inputSyncManager.flush().
  const formDataRef = useRef(formData);
  const lensFormDataRef = useRef(lensFormData);
  const frameFormDataRef = useRef(frameFormData);
  const orderDetailsFormDataRef = useRef(orderDetailsFormData);
  const billingFormDataRef = useRef(billingFormData);
  const finalPrescriptionFormDataRef = useRef(finalPrescriptionFormData);
  const contactFormDataRef = useRef(contactFormData);
  const contactLensExamDataRef = useRef(contactLensExamData);
  const contactLensDetailsDataRef = useRef(contactLensDetailsData);
  const keratoCLDataRef = useRef(keratoCLData);
  const schirmerDataRef = useRef(schirmerData);
  const diametersDataRef = useRef(diametersData);
  const orderLineItemsRef = useRef(orderLineItems);

  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { lensFormDataRef.current = lensFormData; }, [lensFormData]);
  useEffect(() => { frameFormDataRef.current = frameFormData; }, [frameFormData]);
  useEffect(() => { orderDetailsFormDataRef.current = orderDetailsFormData; }, [orderDetailsFormData]);
  useEffect(() => { billingFormDataRef.current = billingFormData; }, [billingFormData]);
  useEffect(() => { finalPrescriptionFormDataRef.current = finalPrescriptionFormData; }, [finalPrescriptionFormData]);
  useEffect(() => { contactFormDataRef.current = contactFormData; }, [contactFormData]);
  useEffect(() => { contactLensExamDataRef.current = contactLensExamData; }, [contactLensExamData]);
  useEffect(() => { contactLensDetailsDataRef.current = contactLensDetailsData; }, [contactLensDetailsData]);
  useEffect(() => { keratoCLDataRef.current = keratoCLData; }, [keratoCLData]);
  useEffect(() => { schirmerDataRef.current = schirmerData; }, [schirmerData]);
  useEffect(() => { diametersDataRef.current = diametersData; }, [diametersData]);
  useEffect(() => { orderLineItemsRef.current = orderLineItems; }, [orderLineItems]);

  const type: ExamComponentType = "final-prescription";
  const getExamFormData = useCallback(() => ({ [type]: finalPrescriptionFormDataRef.current }), [type]);

  const getSerializedState = useCallback(
    () =>
      JSON.stringify({
        isContactMode,
        formData,
        lensFormData,
        frameFormData,
        orderDetailsFormData,
        billingFormData,
        finalPrescriptionFormData,
        contactFormData,
        contactLensExamData,
        contactLensDetailsData,
        keratoCLData,
        schirmerData,
        diametersData,
        orderLineItems,
        deletedOrderLineItemIds,
      }),
    [
      isContactMode,
      formData,
      lensFormData,
      frameFormData,
      orderDetailsFormData,
      billingFormData,
      finalPrescriptionFormData,
      contactFormData,
      contactLensExamData,
      contactLensDetailsData,
      keratoCLData,
      schirmerData,
      diametersData,
      orderLineItems,
      deletedOrderLineItemIds,
    ],
  );

  const {
    hasUnsavedChanges,
    showUnsavedDialog,
    isSaveInFlight,
    setIsSaveInFlight,
    handleNavigationAttempt,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
    allowNavigationRef
  } = useUnsavedChanges({
    getSerializedState,
    isEditing,
    isNewMode
  });

  const fieldHandlers = {
    [type]: (field: string, value: string) =>
      handleFinalPrescriptionChange(
        field as keyof FinalPrescriptionExam,
        value,
      ),
  };
  const toolboxActions = createToolboxActions(getExamFormData, fieldHandlers);
  const [clipboardSourceType, setClipboardSourceType] =
    useState<ExamComponentType | null>(null);

  useEffect(() => {
    setClipboardSourceType(getClipboardContentType());
  }, []);

  const currentCard = { id: "final-prescription", type };
  const allRows = [[currentCard]];

  const handleCopy = () => {
    inputSyncManager.flush();
    copyToClipboard(type, finalPrescriptionFormDataRef.current);
    setClipboardSourceType(type);
    toast.success("נתוני המרשם הועתקו");
  };

  const handlePaste = () => {
    inputSyncManager.flush();
    const clipboardContent = pasteFromClipboard();
    if (!clipboardContent) {
      toast.error("אין נתונים בלוח ההעתקה");
      return;
    }

    const { type: sourceType, data: sourceData } = clipboardContent;
    const isCompatible =
      sourceType === type ||
      ExamFieldMapper.getAvailableTargets(sourceType, [type]).includes(type);

    if (!isCompatible) {
      toast.error("נתונים לא תואמים");
      return;
    }

    const copiedData = ExamFieldMapper.copyData(
      sourceData as Record<string, unknown>,
      finalPrescriptionFormDataRef.current as Record<string, unknown>,
      sourceType,
      type,
    );

    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== "id" && value !== undefined) {
        handleFinalPrescriptionChange(
          key as keyof FinalPrescriptionExam,
          String(value),
        );
      }
    });

    toast.success("נתונים הודבקו בהצלחה");
  };

  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();

  const handleTabChange = (value: string) => {
    if (clientId && value !== "orders") {
      handleNavigationAttempt(() => {
        navigate({
          to: "/clients/$clientId",
          params: { clientId: String(clientId) },
          search: { tab: value },
        });
      });
    }
  };

  useEffect(() => {
    baselineInitializedRef.current = false;
    const loadData = async () => {
      try {
        setLoading(true);

        // Load users for display purposes
        const usersData = await getAllUsers();
        setUsers(usersData);

        if (orderId && !isContactMode) {
          const orderData = await getOrderById(Number(orderId));
          setOrder(orderData || null);

          if (orderData) {
            const fp = (orderData as any).order_data?.["final-prescription"];
            if (fp) {
              setFinalPrescription(fp as FinalPrescriptionExam);
              setFinalPrescriptionFormData({
                ...(fp as FinalPrescriptionExam),
              });
            }
            const od = (orderData as any).order_data || {};
            if (od.lens)
              setLensFormData({
                ...(od.lens as OrderLens),
                order_id: orderData.id!,
              });
            if (od.frame)
              setFrameFormData({
                ...(od.frame as Frame),
                order_id: orderData.id!,
              });
            if (od.details)
              setOrderDetailsFormData({
                ...(od.details as OrderDetails),
                order_id: orderData.id!,
              });
            const billingData = await getBillingByOrderId(Number(orderId));
            setBilling(billingData || null);
            if (billingData && billingData.id) {
              const orderLineItemsData = await getOrderLineItemsByBillingId(
                billingData.id,
              );
              console.log("Loaded line items from server:", orderLineItemsData);
              setOrderLineItems(orderLineItemsData || []);
            } else {
              console.log("No billing found, resetting line items to empty array");
              setOrderLineItems([]);
            }
          }
        } else if (orderId && isContactMode) {
          const clOrder = await getContactLensOrderById(Number(orderId));
          if (clOrder) {
            setContactFormData({ ...clOrder });
            const od = (clOrder as any).order_data || {};
            if (od["contact-lens-exam"])
              setContactLensExamData({ ...(od["contact-lens-exam"] as any) });
            if (od["contact-lens-details"]) {
              setContactLensDetailsData({ ...(od["contact-lens-details"] as any) });
            }
            if (od["keratometer-contact-lens"])
              setKeratoCLData({ ...(od["keratometer-contact-lens"] as any) });
            if (od["schirmer-test"])
              setSchirmerData({ ...(od["schirmer-test"] as any) });
            if (od["contact-lens-diameters"])
              setDiametersData({ ...(od["contact-lens-diameters"] as any) });
            const billingData = await getBillingByContactLensId(
              Number(orderId),
            );
            setBilling(billingData || null);
            if (billingData && billingData.id) {
              const orderLineItemsData = await getOrderLineItemsByBillingId(
                billingData.id,
              );
              console.log("Loaded CL line items from server:", orderLineItemsData);
              setOrderLineItems(orderLineItemsData || []);
            } else {
              console.log("No CL billing found, resetting line items to empty array");
              setOrderLineItems([]);
            }
          }
        } else if (examId) {
          const examData = await getExamById(Number(examId));
          setExam(examData || null);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [clientId, orderId, examId]);

  useEffect(() => {
    if (!loading && !baselineInitializedRef.current) {
      setBaseline();
    }
  }, [loading, setBaseline]);

  useEffect(() => {
    if (order && Object.keys(order).length > 0) {
      setFormData({ ...order });
    }

    if (billing) {
      setBillingFormData({ ...billing });
    }
    if (finalPrescription) {
      setFinalPrescriptionFormData({ ...finalPrescription });
    }
  }, [order, billing, finalPrescription]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    const numericFields = ["comb_va", "comb_high", "comb_pd"];
    if (numericFields.includes(name)) {
      const numValue = parseFloat(value);
      setFormData((prev) => ({
        ...prev,
        [name]: value === "" || isNaN(numValue) ? undefined : numValue,
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLensInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLensFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFrameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    const numericFields = ["bridge", "width", "height", "length"];
    if (numericFields.includes(name)) {
      const numValue = parseFloat(value);
      setFrameFormData((prev) => ({
        ...prev,
        [name]: value === "" || isNaN(numValue) ? undefined : numValue,
      }));
    } else {
      setFrameFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (value: string, name: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLensSelectChange = (value: string, name: string) => {
    setLensFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFrameSelectChange = (value: string, name: string) => {
    setFrameFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleOrderFieldChange = (field: keyof Order, rawValue: string) => {
    let processedValue: string | number | undefined = rawValue;

    const numericFields: (keyof Order)[] = ["comb_va", "comb_high", "comb_pd"];

    if (numericFields.includes(field)) {
      const val = parseFloat(rawValue);
      processedValue = rawValue === "" || isNaN(val) ? undefined : val;
    }

    setFormData((prev) => ({ ...prev, [field]: processedValue }));
  };

  const handleDeleteOrderLineItem = (id: number) => {
    if (id > 0) {
      setDeletedOrderLineItemIds((prev) => [...prev, id]);
    }
    setOrderLineItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleFinalPrescriptionChange = (
    field: keyof FinalPrescriptionExam,
    rawValue: string,
  ) => {
    let processedValue: string | number | undefined = rawValue;

    const numericFields: (keyof FinalPrescriptionExam)[] = [
      "r_sph",
      "l_sph",
      "r_cyl",
      "l_cyl",
      "r_ax",
      "l_ax",
      "r_pris",
      "l_pris",
      "r_ad",
      "l_ad",
      "r_pd",
      "l_pd",
      "r_high",
      "l_high",
      "r_diam",
      "l_diam",
      "comb_pd",
      "comb_high",
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

    setFinalPrescriptionFormData((prev) => ({
      ...prev,
      [field]: processedValue,
    }));
  };

  const handleSave = async () => {
    console.log("Starting save process...");

    // Flush any pending updates from optimized components
    inputSyncManager.flush();

    // After flush, we MUST read from the refs because the local state variables 
    // still hold the "old" values from the previous render.
    const currentFormData = formDataRef.current;
    const currentLensFormData = lensFormDataRef.current;
    const currentFrameFormData = frameFormDataRef.current;
    const currentOrderDetailsFormData = orderDetailsFormDataRef.current;
    const currentBillingFormData = billingFormDataRef.current;
    const currentFinalPrescriptionFormData = finalPrescriptionFormDataRef.current;
    const currentContactFormData = contactFormDataRef.current;
    const currentContactLensExamData = contactLensExamDataRef.current;
    const currentContactLensDetailsData = contactLensDetailsDataRef.current;
    const currentKeratoCLData = keratoCLDataRef.current;
    const currentSchirmerData = schirmerDataRef.current;
    const currentDiametersData = diametersDataRef.current;
    const currentOrderLineItems = orderLineItemsRef.current;

    if (!isContactMode) {
      if (!currentFormData.type) {
        toast.error("אנא בחר סוג הזמנה");
        return;
      }
    } else if (!currentContactFormData.type) {
      toast.error("אנא בחר סוג הזמנה");
      return;
    }

    if (isSaveInFlight) return;

    setIsSaveInFlight(true);

    try {
      if (isContactMode) {
        const hasExam = Object.values(currentContactLensExamData || {}).some(
          (v) => v !== undefined && v !== null && v !== "",
        );
        const hasKerato = Object.values(currentKeratoCLData || {}).some(
          (v) => v !== undefined && v !== null && v !== "",
        );
        const hasSchirmer = Object.values(currentSchirmerData || {}).some(
          (v) => v !== undefined && v !== null && v !== "",
        );
        const hasDiam = Object.values(currentDiametersData || {}).some(
          (v) => v !== undefined && v !== null && v !== "",
        );
        const hasDetails = Object.values(currentContactLensDetailsData || {}).some(
          (v) => v !== undefined && v !== null && v !== "",
        );

        const mergedOrderData: any = isNewMode
          ? {
            client_id: Number(clientId),
            clinic_id: currentClinic?.id,
            order_date: currentContactFormData.order_date,
            type: currentContactFormData.type,
            user_id: currentContactFormData.user_id,
            notes: currentContactFormData.notes,
            supplier_notes: currentContactFormData.supplier_notes,
            order_data: {
              ...(hasDetails
                ? { "contact-lens-details": { ...currentContactLensDetailsData } }
                : {}),
              ...(hasExam
                ? { "contact-lens-exam": { ...currentContactLensExamData } }
                : {}),
              ...(hasKerato
                ? { "keratometer-contact-lens": { ...currentKeratoCLData } }
                : {}),
              ...(hasSchirmer
                ? { "schirmer-test": { ...currentSchirmerData } }
                : {}),
              ...(hasDiam
                ? { "contact-lens-diameters": { ...currentDiametersData } }
                : {}),
            },
          }
          : {
            ...(currentContactFormData as any),
            order_data: {
              ...((currentContactFormData as any)?.order_data || {}),
              ...(hasDetails
                ? { "contact-lens-details": { ...currentContactLensDetailsData } }
                : {}),
              ...(hasExam
                ? { "contact-lens-exam": { ...currentContactLensExamData } }
                : {}),
              ...(hasKerato
                ? { "keratometer-contact-lens": { ...currentKeratoCLData } }
                : {}),
              ...(hasSchirmer
                ? { "schirmer-test": { ...currentSchirmerData } }
                : {}),
              ...(hasDiam
                ? { "contact-lens-diameters": { ...currentDiametersData } }
                : {}),
            },
          };

        const hasBillingData = Object.values(currentBillingFormData).some(
          (value) => value !== undefined && value !== null && value !== "",
        );
        const shouldCreateBilling = hasBillingData || currentOrderLineItems.length > 0;
        const payload: any = {
          order: mergedOrderData,
          billing: shouldCreateBilling ? { ...currentBillingFormData } : null,
          line_items: currentOrderLineItems.map(({ id, billings_id, ...rest }) => {
            if (!id || id <= 0) {
              return { ...rest } as any;
            }
            return { id, ...rest } as any;
          }),
        };
        console.log(
          "Contact lens order payload:",
          JSON.stringify(payload, null, 2),
        );
        console.log("Contact order line items count:", orderLineItems.length);
        console.log("Contact should create billing:", shouldCreateBilling);
        try {
          const upsertResult = await upsertContactLensOrderFull(payload);
          if (!upsertResult || !upsertResult.order) {
            toast.error("שגיאה בשמירת ההזמנה (שרת)");
            setIsEditing(true);
            return;
          }

          toast.success(
            isNewMode ? "הזמנה נשמרה בהצלחה" : "פרטי ההזמנה עודכנו בהצלחה",
          );
          setIsEditing(false);
          const updatedOrder = upsertResult.order as any;
          const updatedBilling = upsertResult.billing as any | undefined;
          const updatedLineItems =
            (upsertResult.line_items as any[] | undefined) || [];
          setContactFormData((prev: any) => ({ ...prev, ...updatedOrder }));
          const od = (updatedOrder as any).order_data || {};
          if (od["contact-lens-details"]) {
            setContactLensDetailsData({ ...(od["contact-lens-details"] as any) });
          }
          if (od["contact-lens-exam"]) {
            setContactLensExamData({ ...(od["contact-lens-exam"] as any) });
          }
          if (od["keratometer-contact-lens"]) {
            setKeratoCLData({ ...(od["keratometer-contact-lens"] as any) });
          }
          if (od["schirmer-test"]) {
            setSchirmerData({ ...(od["schirmer-test"] as any) });
          }
          if (od["contact-lens-diameters"]) {
            setDiametersData({ ...(od["contact-lens-diameters"] as any) });
          }
          if (updatedBilling) {
            setBilling(updatedBilling);
            setBillingFormData((prev) => ({
              ...prev,
              ...(updatedBilling as any),
            }));
          }
          console.log(
            "Setting line items after save (contact):",
            updatedLineItems,
          );
          setOrderLineItems(updatedLineItems as any);
          setDeletedOrderLineItemIds([]);

          const nextBillingFormData = updatedBilling
            ? { ...billingFormData, ...(updatedBilling as any) }
            : billingFormData;
          const nextContactFormData = { ...contactFormData, ...updatedOrder };
          const nextContactLensExamData = od["contact-lens-exam"]
            ? { ...(od["contact-lens-exam"] as any) }
            : contactLensExamData;
          const nextContactLensDetailsData = od["contact-lens-details"]
            ? { ...(od["contact-lens-details"] as any) }
            : contactLensDetailsData;
          const nextKeratoCLData = od["keratometer-contact-lens"]
            ? { ...(od["keratometer-contact-lens"] as any) }
            : keratoCLData;
          const nextSchirmerData = od["schirmer-test"]
            ? { ...(od["schirmer-test"] as any) }
            : schirmerData;
          const nextDiametersData = od["contact-lens-diameters"]
            ? { ...(od["contact-lens-diameters"] as any) }
            : diametersData;

          setBaseline({
            isContactMode,
            formData: currentFormData,
            lensFormData: currentLensFormData,
            frameFormData: currentFrameFormData,
            orderDetailsFormData: currentOrderDetailsFormData,
            billingFormData: nextBillingFormData,
            finalPrescriptionFormData: currentFinalPrescriptionFormData,
            contactFormData: nextContactFormData,
            contactLensExamData: nextContactLensExamData,
            contactLensDetailsData: nextContactLensDetailsData,
            keratoCLData: nextKeratoCLData,
            schirmerData: nextSchirmerData,
            diametersData: nextDiametersData,
            orderLineItems: updatedLineItems as any,
            deletedOrderLineItemIds: [],
          });

          if (onSave) onSave(updatedOrder);
          if (isNewMode && clientId) {
            allowNavigationRef.current = true;
            navigate({
              to: "/clients/$clientId",
              params: { clientId: String(clientId) },
              search: { tab: "orders" },
            });
            setTimeout(() => {
              allowNavigationRef.current = false;
            }, 0);
          }
        } catch (error) {
          console.error("Error saving contact order:", error);
          toast.error("שגיאה בשמירת ההזמנה (רשת)");
          setIsEditing(true);
        }
        return;
      }

      const hasFinalPrescriptionData = Object.values(
        currentFinalPrescriptionFormData,
      ).some(
        (value) =>
          value !== undefined && value !== null && value !== "" && value !== 0,
      );
      const mergedOrderData = isNewMode
        ? {
          client_id: Number(clientId),
          clinic_id: currentClinic?.id,
          order_date: currentFormData.order_date,
          type: currentFormData.type,
          dominant_eye: currentFormData.dominant_eye,
          user_id: currentFormData.user_id,
          comb_va: currentFormData.comb_va,
          comb_high: currentFormData.comb_high,
          comb_pd: currentFormData.comb_pd,
          order_data: {
            ...(hasFinalPrescriptionData
              ? { "final-prescription": { ...currentFinalPrescriptionFormData } }
              : {}),
            lens: { ...currentLensFormData },
            frame: { ...currentFrameFormData },
            details: { ...currentOrderDetailsFormData },
          },
        }
        : {
          ...(currentFormData as Order),
          order_date: currentFormData.order_date,
          type: currentFormData.type,
          dominant_eye: currentFormData.dominant_eye,
          user_id: currentFormData.user_id,
          comb_va: currentFormData.comb_va,
          comb_high: currentFormData.comb_high,
          comb_pd: currentFormData.comb_pd,
          order_data: {
            ...((order as any)?.order_data || {}),
            ...(hasFinalPrescriptionData
              ? { "final-prescription": { ...currentFinalPrescriptionFormData } }
              : {}),
            lens: { ...currentLensFormData },
            frame: { ...currentFrameFormData },
            details: { ...currentOrderDetailsFormData },
          },
        };

      const hasBillingData = Object.values(currentBillingFormData).some(
        (value) => value !== undefined && value !== null && value !== "",
      );
      const shouldCreateBilling = hasBillingData || currentOrderLineItems.length > 0;
      const payload: any = {
        order: mergedOrderData,
        billing: shouldCreateBilling ? { ...currentBillingFormData } : null,
        line_items: currentOrderLineItems.map(({ id, billings_id, ...rest }) => {
          if (!id || id <= 0) {
            return { ...rest } as any;
          }
          return { id, ...rest } as any;
        }),
      };

      console.log("Regular order payload:", JSON.stringify(payload, null, 2));
      console.log("Order line items count:", orderLineItems.length);
      console.log("Should create billing:", shouldCreateBilling);
      console.log("Billing form data:", billingFormData);

      try {
        const upsertResult = await upsertOrderFull(payload);
        console.log("Regular order upsert result:", upsertResult);
        if (!upsertResult || !upsertResult.order) {
          toast.error("שגיאה בשמירת ההזמנה (שרת)");
          setIsEditing(true);
          return;
        }

        toast.success(
          isNewMode ? "הזמנה נשמרה בהצלחה" : "פרטי ההזמנה עודכנו בהצלחה",
        );
        setIsEditing(false);
        const updatedOrder = upsertResult.order as Order;
        const updatedBilling = upsertResult.billing as Billing | undefined;
        const updatedLineItems =
          (upsertResult.line_items as OrderLineItem[] | undefined) || [];
        console.log("Updated billing:", updatedBilling);
        console.log("Updated line items:", updatedLineItems);
        console.log("Updated line items length:", updatedLineItems.length);

        // Merge server response with local state to prevent rollback/data loss
        // We trust the server for IDs and system fields, but we trust local state (formData)
        // for the content fields we just edited, in case the server response is stale.
        const od = (updatedOrder as any).order_data || {};

        const nextLensFormData = {
          ...(od.lens || {}), // Server base
          ...currentLensFormData,    // Local overrides
          order_id: updatedOrder.id! // Enforce ID
        } as OrderLens;

        const nextFrameFormData = {
          ...(od.frame || {}),
          ...currentFrameFormData,
          order_id: updatedOrder.id!
        } as Frame;

        const nextOrderDetailsFormData = {
          ...(od.details || {}),
          ...currentOrderDetailsFormData,
          order_id: updatedOrder.id!
        } as OrderDetails;

        const fp2 = od["final-prescription"];
        const nextFinalPrescriptionFormData = {
          ...(fp2 as FinalPrescriptionExam || {}),
          ...currentFinalPrescriptionFormData
        } as FinalPrescriptionExam;

        const nextOrderData = {
          ...od,
          lens: nextLensFormData,
          frame: nextFrameFormData,
          details: nextOrderDetailsFormData,
          "final-prescription": nextFinalPrescriptionFormData
        };

        const nextFormData = {
          ...updatedOrder,
          ...currentFormData, // Local overrides
          id: updatedOrder.id!,
          order_data: nextOrderData
        } as Order;

        setOrder(nextFormData);
        setFormData(nextFormData);

        setLensFormData(nextLensFormData);
        setFrameFormData(nextFrameFormData);
        setOrderDetailsFormData(nextOrderDetailsFormData);

        if (fp2 || Object.keys(currentFinalPrescriptionFormData).length > 0) {
          setFinalPrescription(nextFinalPrescriptionFormData);
          setFinalPrescriptionFormData(nextFinalPrescriptionFormData);
        }

        if (updatedBilling) {
          setBilling(updatedBilling as any);
          setBillingFormData((prev) => ({
            ...prev,
            ...(updatedBilling as any),
          }));
        }
        console.log("Setting line items after save (regular):", updatedLineItems);
        setOrderLineItems(updatedLineItems);
        setDeletedOrderLineItemIds([]);

        const nextBillingFormData = updatedBilling
          ? { ...billingFormData, ...(updatedBilling as any) }
          : billingFormData;

        setBaseline({
          isContactMode,
          formData: nextFormData,
          lensFormData: nextLensFormData,
          frameFormData: nextFrameFormData,
          orderDetailsFormData: nextOrderDetailsFormData,
          billingFormData: nextBillingFormData,
          finalPrescriptionFormData: nextFinalPrescriptionFormData,
          contactFormData,
          contactLensExamData,
          contactLensDetailsData,
          keratoCLData,
          schirmerData,
          diametersData,
          orderLineItems: updatedLineItems,
          deletedOrderLineItemIds: [],
        });

        if (onSave) onSave(updatedOrder);
        if (isNewMode && clientId) {
          allowNavigationRef.current = true;
          navigate({
            to: "/clients/$clientId",
            params: { clientId: String(clientId) },
            search: { tab: "orders" },
          });
          setTimeout(() => {
            allowNavigationRef.current = false;
          }, 0);
        }
      } catch (error) {
        console.error("Error saving regular order:", error);
        toast.error("שגיאה בשמירת ההזמנה (רשת)");
        setIsEditing(true);
      }
    } finally {
      setIsSaveInFlight(false);
    }
  };

  const handleExportDocx = async () => {
    try {
      const orderToExport = isContactMode ? contactFormData : formData;
      const userData = users.find((u) => u.id === orderToExport.user_id);

      // Use currentClient if available, otherwise it should already be loaded from context
      // For safety, we're using currentClient which should have full data
      const clientData = currentClient;

      const templateData = OrderToDocxMapper.mapOrderToTemplateData(
        orderToExport,
        clientData,
        userData,
        billing,
        orderLineItems
      );

      // Use different templates based on order type
      const templatePath = isContactMode
        ? "/templates/template.docx"
        : "/templates/template_regular_order.docx";

      await docxGenerator.generate(templateData, undefined, templatePath);
      toast.success("הדוח יוצא בהצלחה");
    } catch (error) {
      console.error("Error exporting DOCX:", error);
      toast.error("שגיאה ביצירת הדוח");
    }
  };

  if (loading || !currentClient) {
    return (
      <>
        <SiteHeader
          title="לקוחות"
          backLink="/clients"
          tabs={{
            activeTab,
            onTabChange: handleTabChange,
          }}
        />
        <ClientSpaceLayout>
          <div
            className="no-scrollbar mb-10 flex flex-1 flex-col p-4 lg:p-6"
            dir="rtl"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {!isContactMode ? (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <Tabs defaultValue="order" dir="rtl">
                    <TabsList className="grid w-auto grid-cols-2">
                      <TabsTrigger value="order">הזמנה</TabsTrigger>
                      <TabsTrigger value="billing">חיובים</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex gap-2">
                    {isNewMode && onCancel && (
                      <Button variant="outline" disabled>
                        ביטול
                      </Button>
                    )}
                    <Button variant="default" disabled>
                      {isNewMode
                        ? "שמור הזמנה"
                        : isEditing
                          ? "שמור שינויים"
                          : "ערוך הזמנה"}
                    </Button>
                  </div>
                </div>

                {/* Header card (order fields) */}
                <div className="mt-1">
                  <Skeleton className="h-23 w-full rounded-md" />
                </div>

                {/* Final Prescription big card */}
                <div className="mt-4">
                  <Skeleton className="h-51 w-full rounded-md" />
                </div>

                {/* Two side cards: Lens details + Frame details */}
                <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-11">
                  <Skeleton className="col-span-1 h-23 w-full rounded-md" />
                  <Skeleton className="col-span-5 h-84 w-full rounded-md" />
                  <Skeleton className="col-span-5 h-84 w-full rounded-md" />
                </div>
              </>
            ) : (
              <>
                <div className="mb-5 flex items-center justify-between">
                  <Tabs defaultValue="order" dir="rtl">
                    <TabsList className="grid w-auto grid-cols-2">
                      <TabsTrigger value="order">הזמנת עדשות</TabsTrigger>
                      <TabsTrigger value="billing">חיובים</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="flex gap-2">
                    {isNewMode && onCancel && (
                      <Button variant="outline" disabled>
                        ביטול
                      </Button>
                    )}
                    <Button variant="default" disabled>
                      {isNewMode
                        ? "שמור הזמנה"
                        : isEditing
                          ? "שמור שינויים"
                          : "ערוך הזמנה"}
                    </Button>
                  </div>
                </div>

                {/* Header card (order fields) */}
                <div className="mt-2">
                  <Skeleton className="h-23 w-full rounded-md" />
                </div>

                {/* Contact lens details card */}
                <div className="mt-4">
                  <Skeleton className="h-40 w-full rounded-md" />
                </div>

                {/* Contact lens exam card */}
                <div className="mt-4">
                  <Skeleton className="h-50 w-full rounded-md" />
                </div>

                {/* Exams row: Keratometer (5/9), Schirmer (2/9), Diameters (2/9) */}
                <div className="mt-4 grid grid-cols-10 gap-4" dir="ltr">
                  <div className="col-span-9 lg:col-span-5">
                    <Skeleton className="h-50 w-full rounded-md" />
                  </div>
                  <div className="col-span-9 lg:col-span-2">
                    <Skeleton className="h-50 w-full rounded-md" />
                  </div>
                  <div className="col-span-9 lg:col-span-2">
                    <Skeleton className="h-50 w-full rounded-md" />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Skeleton className="ml-3 h-25 rounded-md" />
                  </div>
                </div>
              </>
            )}
          </div>
        </ClientSpaceLayout>
      </>
    );
  }

  if (!isNewMode) {
    const showNotFound = isContactMode
      ? !Boolean((contactFormData as any)?.id) && !Boolean(orderId)
      : !Boolean(order);
    if (showNotFound) {
      return (
        <>
          <SiteHeader
            title="לקוחות"
            backLink="/clients"
            tabs={{
              activeTab,
              onTabChange: handleTabChange,
            }}
          />
          <div className="flex h-full flex-col items-center justify-center">
            <h1 className="text-2xl">הזמנה לא נמצאה</h1>
          </div>
        </>
      );
    }
  }


  return (
    <>
      <SiteHeader
        title="לקוחות"
        backLink="/clients"
        clientBackLink={`/clients/${clientId}`}
        examInfo={isNewMode ? "הזמנה חדשה" : `הזמנה מס' ${orderId}`}
        tabs={{
          activeTab,
          onTabChange: handleTabChange,
        }}
      />
      <ClientSpaceLayout>
        <div
          className="no-scrollbar mb-10 flex flex-1 flex-col p-4 lg:p-6"
          dir="rtl"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            maxWidth: UI_CONFIG.pageMaxWidth,
            margin: "0 auto",
          }}
        >
          <Tabs
            defaultValue={isContactMode ? "contact" : "order"}
            className="w-full"
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <TabsList className="grid w-auto grid-cols-2">
                {!isContactMode ? (
                  <TabsTrigger value="order">הזמנה</TabsTrigger>
                ) : (
                  <TabsTrigger value="contact">הזמנת עדשות</TabsTrigger>
                )}
                <TabsTrigger value="billing">חיובים</TabsTrigger>
              </TabsList>
              <div className="flex gap-2">
                {isNewMode && onCancel && (
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavigationAttempt(() => {
                        if (onCancel) onCancel();
                      });
                    }}
                  >
                    ביטול
                  </Button>
                )}
                {!isNewMode && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleExportDocx}
                    title="ייצוא לדוח Word"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant={isEditing ? "outline" : "default"}
                  disabled={isSaveInFlight}
                  className="h-9 px-4"
                  onClick={() => {
                    if (isNewMode || isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                >
                  {isSaveInFlight ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : isNewMode || isEditing ? (
                    <Save size={18} />
                  ) : (
                    <Edit size={18} />
                  )}
                </Button>
              </div>
            </div>

            {!isContactMode && (
              <TabsContent value="order" className="space-y-4">
                <RegularOrderTab
                  formRef={formRef}
                  isEditing={isEditing}
                  users={users}
                  formData={formData}
                  setFormData={setFormData}
                  onSelectChange={handleSelectChange}
                  finalPrescriptionData={finalPrescriptionFormData}
                  onFinalPrescriptionChange={handleFinalPrescriptionChange}
                  currentCard={currentCard}
                  allRows={allRows}
                  clipboardSourceType={clipboardSourceType}
                  onToolboxClearData={() => toolboxActions.clearData(type)}
                  onToolboxCopy={handleCopy}
                  onToolboxPaste={handlePaste}
                  lensFormData={lensFormData}
                  setLensFormData={setLensFormData}
                  frameFormData={frameFormData}
                  setFrameFormData={setFrameFormData}
                  onFrameSelectChange={handleFrameSelectChange}
                  onFrameInputChange={handleFrameInputChange}
                  orderDetailsFormData={orderDetailsFormData}
                  setOrderDetailsFormData={setOrderDetailsFormData}
                />
              </TabsContent>
            )}

            {isContactMode && (
              <TabsContent value="contact" className="space-y-4">
                <ContactOrderTab
                  formRef={formRef}
                  isEditing={isEditing}
                  users={users}
                  contactFormData={contactFormData}
                  setContactFormData={setContactFormData}
                  contactLensDetailsData={contactLensDetailsData}
                  setContactLensDetailsData={setContactLensDetailsData}
                  contactLensExamData={contactLensExamData}
                  setContactLensExamData={setContactLensExamData}
                  keratoCLData={keratoCLData}
                  setKeratoCLData={setKeratoCLData}
                  schirmerData={schirmerData}
                  setSchirmerData={setSchirmerData}
                  diametersData={diametersData}
                  setDiametersData={setDiametersData}
                />
              </TabsContent>
            )}

            <TabsContent value="billing" className="space-y-4">
              <BillingTab
                billingFormData={billingFormData}
                setBillingFormData={setBillingFormData}
                orderLineItems={orderLineItems}
                setOrderLineItems={setOrderLineItemsWithLogging}
                isEditing={isEditing}
                handleDeleteOrderLineItem={handleDeleteOrderLineItem}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ClientSpaceLayout>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
      />
    </>
  );
}
