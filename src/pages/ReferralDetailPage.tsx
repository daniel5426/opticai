import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react"
import { Loader2, Save, Edit } from "lucide-react"
import { useParams, useNavigate, useLocation } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Referral, Client } from "@/lib/db/schema-interface"
import {
  getReferralById,
  updateReferral,
  createReferral
} from "@/lib/db/referral-db"
import { getClientById } from "@/lib/db/clients-db"
import { toast } from "sonner"
import { CompactPrescriptionTab } from "@/components/exam/CompactPrescriptionTab"
import { ExamToolbox, createToolboxActions } from "@/components/exam/ExamToolbox"
import { ExamFieldMapper, ExamComponentType } from "@/lib/exam-field-mappings"
import { copyToClipboard, pasteFromClipboard, getClipboardContentType } from "@/lib/exam-clipboard"
import { CompactPrescriptionExam } from "@/lib/db/schema-interface"
import { apiClient } from "@/lib/api-client"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { Skeleton } from "@/components/ui/skeleton"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"
import { useUser } from "@/contexts/UserContext"
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs"
import { NotesCard } from "@/components/ui/notes-card"

export default function ReferralDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState('referrals')

  // Check if we're on the create route
  const isNewReferral = location.pathname.endsWith('/referrals/new')
  const [isEditing, setIsEditing] = useState(isNewReferral)

  // Get params for nested referral routes
  const routeParams = isNewReferral
    ? useParams({ from: "/clients/$clientId/referrals/new" })
    : useParams({ from: "/clients/$clientId/referrals/$referralId" })
  const clientIdFromRoute = routeParams.clientId as string | undefined
  const referralId = isNewReferral ? undefined : (routeParams as any).referralId as string | undefined

  const [formData, setFormData] = useState<Referral>({
    client_id: 0,
    referral_notes: '',
    prescription_notes: '',
    date: '',
    type: '',
    urgency_level: '',
    recipient: '',
    referral_data: {
      'clinical-findings': {
        r_iop: '',
        l_iop: '',
        clinical_impression: ''
      }
    }
  })

  const [compactPrescription, setCompactPrescription] = useState<CompactPrescriptionExam | null>(null)
  const [compactPrescriptionFormData, setCompactPrescriptionFormData] = useState<CompactPrescriptionExam>({
    referral_id: 0
  })

  const type: ExamComponentType = 'compact-prescription'
  const compactPrescriptionFormDataRef = useRef(compactPrescriptionFormData)
  useLayoutEffect(() => {
    compactPrescriptionFormDataRef.current = compactPrescriptionFormData
  }, [compactPrescriptionFormData])

  const getExamFormData = useCallback(() => ({ [type]: compactPrescriptionFormDataRef.current }), [type])

  const fieldHandlers = { [type]: (field: string, value: string) => handleCompactPrescriptionChange(field as keyof CompactPrescriptionExam, value) }
  const toolboxActions = createToolboxActions(getExamFormData, fieldHandlers)
  const [clipboardSourceType, setClipboardSourceType] = useState<ExamComponentType | null>(null)

  useEffect(() => {
    setClipboardSourceType(getClipboardContentType())
  }, [])

  const currentCard = { id: 'compact-prescription', type }
  const allRows = [[currentCard]]

  const handleCopy = () => {
    inputSyncManager.flush();
    copyToClipboard(type, compactPrescriptionFormDataRef.current)
    setClipboardSourceType(type)
    toast.success("נתוני הממרשם הועתקו")
  }

  const handlePaste = () => {
    inputSyncManager.flush();
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

    const copiedData = ExamFieldMapper.copyData(sourceData as any, compactPrescriptionFormDataRef.current as any, sourceType, type)

    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        handleCompactPrescriptionChange(key as keyof CompactPrescriptionExam, String(value))
      }
    })

    toast.success("נתונים הודבקו בהצלחה")
  }



  const { currentClient } = useClientSidebar()

  useEffect(() => {
    const loadReferralData = async () => {
      try {
        setLoading(true)

        // Load client data first
        const clientId = isNewReferral ? clientIdFromRoute : formData.client_id?.toString()
        if (clientId) {
          const clientData = await getClientById(Number(clientId))
          setClient(clientData || null)
        } else if (currentClient) {
          setClient(currentClient)
        }

        if (isNewReferral) {
          if (clientIdFromRoute) {
            setFormData((prev: Referral) => ({ ...prev, client_id: Number(clientIdFromRoute) }))
          }
          setLoading(false)
          return
        }

        if (!referralId) {
          setLoading(false)
          return
        }

        const referral = await getReferralById(Number(referralId))
        if (referral) {
          setFormData(referral)

          // Load client if not already loaded
          if (!client && referral.client_id) {
            const clientData = await getClientById(referral.client_id)
            setClient(clientData || null)
          }

          const cp = (referral as any).referral_data?.['compact-prescription']
          if (cp) {
            setCompactPrescription(cp)
            setCompactPrescriptionFormData(cp)
          } else {
            setCompactPrescriptionFormData((prev: CompactPrescriptionExam) => ({ ...prev, referral_id: Number(referralId) }))
          }

          // Ensure referral_data has the expected structure
          setFormData(prev => ({
            ...prev,
            referral_data: {
              ...prev.referral_data,
              'clinical-findings': {
                r_iop: (prev.referral_data as any)?.['clinical-findings']?.r_iop || '',
                l_iop: (prev.referral_data as any)?.['clinical-findings']?.l_iop || '',
                clinical_impression: (prev.referral_data as any)?.['clinical-findings']?.clinical_impression || ''
              }
            }
          }))
        }
      } catch (error) {
        console.error('Error loading referral:', error)
        toast.error("שגיאה בטעינת ההפניה")
      } finally {
        setLoading(false)
      }
    }

    loadReferralData()
  }, [referralId, isNewReferral, clientIdFromRoute, currentClient])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCompactPrescriptionChange = (field: keyof CompactPrescriptionExam, value: any) => {
    setCompactPrescriptionFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleClinicalFindingsChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      referral_data: {
        ...(prev.referral_data || {}),
        'clinical-findings': {
          ...((prev.referral_data as any)?.['clinical-findings'] || {}),
          [field]: value
        }
      }
    }))
  }

  const handleTabChange = (value: string) => {
    const clientId = isNewReferral ? clientIdFromRoute : formData.client_id?.toString()
    if (clientId && value !== 'referrals') {
      navigate({
        to: "/clients/$clientId",
        params: { clientId: String(clientId) },
        search: { tab: value }
      })
    }
  }

  const [isSaveInFlight, setIsSaveInFlight] = useState(false)

  const handleSave = async () => {
    if (isSaveInFlight) return;

    try {
      setIsSaveInFlight(true);

      // Flush any pending updates from optimized components
      inputSyncManager.flush();

      // Prepare the referral_data by merging current clinical findings with current prescription form data
      const finalReferralData = {
        ...(formData.referral_data || {}),
        'compact-prescription': { ...compactPrescriptionFormData }
      }

      const basePayload = {
        ...formData,
        referral_data: finalReferralData,
        date: formData.date && formData.date.trim() !== '' ? formData.date : undefined,
      }

      if (isNewReferral) {
        const createPayload = {
          ...basePayload,
          clinic_id: currentClinic?.id,
        }

        const created = await createReferral(createPayload as any)

        if (created && created.id) {
          toast.success("ההפניה נשמרה בהצלחה")
          setIsEditing(false)
          if (clientIdFromRoute) {
            navigate({ to: `/clients/${clientIdFromRoute}`, search: { tab: 'referrals' } })
          }
        } else {
          toast.error("לא הצלחנו ליצור את ההפניה")
        }
      } else {
        const savedReferral = await updateReferral(basePayload as any)
        if (savedReferral) {
          setFormData(savedReferral)
          toast.success("ההפניה נשמרה בהצלחה")
          setIsEditing(false)
        } else {
          toast.error("שגיאה בשמירת ההפניה")
        }
      }
    } catch (error) {
      console.error('Error in handleSave:', error)
      toast.error("שגיאה בשמירת ההפניה")
      setIsEditing(true)
    } finally {
      setIsSaveInFlight(false);
    }
  }

  const handleEditButtonClick = () => {
    if (isEditing) {
      handleSave();
    } else {
      setIsEditing(true);
    }
  }

  const handleCancel = () => {
    if (isNewReferral && clientIdFromRoute) {
      navigate({ to: `/clients/${clientIdFromRoute}`, search: { tab: 'referrals' } })
    } else if (formData.client_id) {
      navigate({ to: `/clients/${formData.client_id}`, search: { tab: 'referrals' } })
    } else {
      navigate({ to: "/clients" })
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader
          title="לקוחות"
          backLink="/clients"
          clientBackLink={clientIdFromRoute || formData.client_id ? `/clients/${clientIdFromRoute || formData.client_id}` : "/clients"}
          examInfo="הפניה"
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <ClientSpaceLayout>
          <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10 no-scrollbar" dir="rtl" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <div className="flex justify-between items-center mb-10">
              <div></div>
              <div className="flex gap-2">
                {isNewReferral && (
                  <Button variant="outline" disabled>ביטול</Button>
                )}
                <Button variant="default" disabled>
                  {isNewReferral ? "שמור הפניה" : (isEditing ? "שמור שינויים" : "ערוך הפניה")}
                </Button>
              </div>
            </div>

            <div className="mb-8">
              <div className="w-full p-4 rounded-md bg-muted/40">
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20 ml-auto" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mb-6">
              <div className="rounded-md p-4 bg-muted/40">
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <Skeleton className="h-5 w-36" />
                  </div>
                  <div className="grid grid-cols-10 gap-2">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-md p-4 bg-muted/40">
                <div className="space-y-2 mb-3">
                  <Skeleton className="h-5 w-28 ml-auto" />
                  <Skeleton className="h-3 w-40 ml-auto" />
                </div>
                <Skeleton className="h-28 w-full" />
              </div>
              <div className="rounded-md p-4 bg-muted/40">
                <div className="space-y-2 mb-3">
                  <Skeleton className="h-5 w-32 ml-auto" />
                  <Skeleton className="h-3 w-44 ml-auto" />
                </div>
                <Skeleton className="h-28 w-full" />
              </div>
            </div>
          </div>
        </ClientSpaceLayout>
      </>
    )
  }

  const fullName = client ? `${client.first_name} ${client.last_name}`.trim() : ''

  return (
    <>
      <SiteHeader
        title="לקוחות"
        backLink="/clients"
        clientBackLink={currentClient?.id ? `/clients/${currentClient.id}` : "/clients"}
        examInfo={isNewReferral ? "הפניה חדשה" : `הפניה מס' ${referralId}`}
        tabs={{
          activeTab,
          onTabChange: handleTabChange
        }}
      />
      <ClientSpaceLayout>
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{ scrollbarWidth: 'none' }}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">
                {isNewReferral ? 'הפניה חדשה' : 'פרטי הפניה'}
              </h1>
              <div className="flex gap-2">
                {isNewReferral && (
                  <Button variant="outline" onClick={handleCancel}>
                    ביטול
                  </Button>
                )}
                <Button
                  variant={isEditing ? "outline" : "default"}
                  onClick={handleEditButtonClick}
                  disabled={isSaveInFlight}
                  className="h-9 px-4"
                >
                  {isSaveInFlight ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : isNewReferral || isEditing ? (
                    <Save size={18} />
                  ) : (
                    <Edit size={18} />
                  )}
                </Button>
              </div>
            </div>

            <Card className="w-full p-4 pt-3 shadow-md">
              <div className="grid grid-cols-4 gap-x-3 gap-y-2 w-full" dir="rtl">
                <div className="col-span-1">
                  <label className="font-semibold text-base">תאריך</label>
                  <div className="h-1"></div>
                  <Input
                    type="date"
                    name="date"
                    value={formData.date || ''}
                    onChange={handleInputChange}
                    disabled={!isEditing}
                    className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                </div>
                <div className="col-span-1">
                  <label className="font-semibold text-base">סוג הפניה</label>
                  <div className="h-1"></div>
                  <Input
                    name="type"
                    value={formData.type || ''}
                    onChange={handleInputChange}
                    placeholder="סוג ההפניה"
                    disabled={!isEditing}
                    className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                </div>
                <div className="col-span-1">
                  <label className="font-semibold text-base">רמת דחיפות</label>
                  <div className="h-1"></div>
                  <Select
                    value={formData.urgency_level || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, urgency_level: value }))}
                    disabled={!isEditing}
                  >
                    <SelectTrigger className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}>
                      <SelectValue placeholder="בחר רמת דחיפות" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="routine">שגרתי</SelectItem>
                      <SelectItem value="urgent">דחוף</SelectItem>
                      <SelectItem value="emergency">חירום</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <label className="font-semibold text-base">נמען</label>
                  <div className="h-1"></div>
                  <Input
                    name="recipient"
                    value={formData.recipient || ''}
                    onChange={handleInputChange}
                    placeholder="נמען ההפניה"
                    disabled={!isEditing}
                    className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-9 gap-6 items-stretch relative">
              <div className="lg:col-span-6 flex flex-col gap-6">
                <Card className="w-full p-4 pt-3 gap-4 shadow-md">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-muted rounded-md">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                      </svg>
                    </div>
                    <h3 className="text-base font-semibold">ממצאים קליניים</h3>
                  </div>
                  <div className="grid grid-cols-9 gap-x-4 gap-y-2 w-full" dir="rtl">
                    <div className="col-span-7">
                      <label className="text-sm font-medium justify-center text-muted-foreground">הערכה קלינית / אבחנה משוערת</label>
                      <div className="h-1"></div>
                      <Input
                        value={(formData.referral_data as any)?.['clinical-findings']?.clinical_impression || ''}
                        onChange={(e) => handleClinicalFindingsChange('clinical_impression', e.target.value)}
                        placeholder="למשל: חשד לגלאוקומה, קטרקט..."
                        disabled={!isEditing}
                        className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block w-full text-center text-muted-foreground">R-IOP</label>
                      <div className="h-1"></div>
                      <Input
                        type="number"
                        dir="ltr"
                        min={0}
                        max={70}
                        value={(formData.referral_data as any)?.['clinical-findings']?.r_iop || ''}
                        onChange={(e) => handleClinicalFindingsChange('r_iop', e.target.value)}
                        suffix="mmHg"
                        disabled={!isEditing}
                        className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-sm font-medium block w-full text-center text-muted-foreground">L-IOP</label>
                      <div className="h-1"></div>
                      <Input
                        dir="ltr"
                        type="number"
                        min={0}
                        max={70}
                        value={(formData.referral_data as any)?.['clinical-findings']?.l_iop || ''}
                        onChange={(e) => handleClinicalFindingsChange('l_iop', e.target.value)}
                        suffix="mmHg"
                        disabled={!isEditing}
                        className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                      />
                    </div>
                  </div>
                </Card>

                <div className="relative">
                  <CompactPrescriptionTab
                    data={compactPrescriptionFormData}
                    onChange={(field, value) => handleCompactPrescriptionChange(field as keyof CompactPrescriptionExam, value)}
                    isEditing={isEditing}
                  />
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
                      onCopyLeft={() => { }}
                      onCopyRight={() => { }}
                      onCopyBelow={() => { }}
                      showClear={true}
                    />
                  )}
                </div>
              </div>

              <div className="lg:col-span-3">
                <NotesCard
                  title="הערות"
                  value={formData.referral_notes || ''}
                  onChange={(value) => setFormData(prev => ({ ...prev, referral_notes: value }))}
                  disabled={!isEditing}
                  placeholder="הערות להפניה..."
                  height="293px"
                />
              </div>
            </div>
          </div>
        </div>
      </ClientSpaceLayout>
    </>
  )
} 