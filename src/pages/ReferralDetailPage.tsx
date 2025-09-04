import React, { useState, useEffect } from "react"
import { useParams, useNavigate, useLocation } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
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
    recipient: ''
  })

  const [compactPrescription, setCompactPrescription] = useState<CompactPrescriptionExam | null>(null)
  const [compactPrescriptionFormData, setCompactPrescriptionFormData] = useState<CompactPrescriptionExam>({
    referral_id: 0
  })

  const type: ExamComponentType = 'compact-prescription'
  const examFormData = { [type]: compactPrescriptionFormData }
  const fieldHandlers = { [type]: (field: string, value: string) => handleCompactPrescriptionChange(field as keyof CompactPrescriptionExam, value) }
  const toolboxActions = createToolboxActions(examFormData, fieldHandlers)
  const [clipboardSourceType, setClipboardSourceType] = useState<ExamComponentType | null>(null)

  useEffect(() => {
    setClipboardSourceType(getClipboardContentType())
  }, [])

  const currentCard = { id: 'compact-prescription', type }
  const allRows = [[currentCard]]

  const handleCopy = () => {
    copyToClipboard(type, compactPrescriptionFormData)
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

    const copiedData = ExamFieldMapper.copyData(sourceData as any, compactPrescriptionFormData as any, sourceType, type)

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

  const handleSave = async () => {
    try {
      if (isNewReferral) {
        // Optimistic UI update for new referral
        setIsEditing(false)
        toast.success("ההפניה נשמרה בהצלחה")
        if (clientIdFromRoute) {
          navigate({ to: `/clients/${clientIdFromRoute}`, search: { tab: 'referrals' } })
        }

        // Background server work
        ;(async () => {
          try {
            const createPayload = {
              ...formData,
              clinic_id: currentClinic?.id,
              date: formData.date && formData.date.trim() !== '' ? formData.date : undefined,
            }
            const created = await createReferral(createPayload as any)
            if (created && created.id) {
              // Save compact prescription data in background
              const compactPrescriptionToSave = { ...compactPrescriptionFormData, referral_id: created.id! }
              const hasCP = Object.values(compactPrescriptionFormData).some(v => v !== undefined && v !== null && v !== '' && v !== 0)
              if (hasCP) {
                const merged = {
                  ...((created as any)?.referral_data || {}),
                  'compact-prescription': { ...compactPrescriptionToSave }
                }
                await updateReferral({ ...(created as Referral), referral_data: merged })
              }
            } else {
              toast.error("לא הצלחנו ליצור את ההפניה")
              // Re-enable editing on error
              setIsEditing(true)
            }
          } catch (error) {
            console.error('Background referral creation error:', error)
            toast.error("שמירת ההפניה נכשלה ברקע")
            // Re-enable editing on error
            setIsEditing(true)
          }
        })()
      } else {
        // Optimistic UI update for existing referral
        setIsEditing(false)
        toast.success("ההפניה נשמרה בהצלחה")

        const updatePayload = {
          ...formData,
          date: formData.date && formData.date.trim() !== '' ? formData.date : undefined,
        }

        // Update formData optimistically with the current values
        setFormData(prev => ({ ...prev, ...updatePayload }))

        // Background server work
        ;(async () => {
          try {
            const savedReferral = await updateReferral(updatePayload as any)
            if (savedReferral) {
              setFormData(savedReferral)
            } else {
              toast.error("שגיאה בשמירת ההפניה")
              setIsEditing(true)
            }
          } catch (error) {
            console.error('Background referral update error:', error)
            toast.error("שגיאה בשמירת ההפניה")
            setIsEditing(true)
          }
        })()
      }
    } catch (error) {
      console.error('Error in handleSave:', error)
      toast.error("שגיאה בשמירת ההפניה")
      setIsEditing(true)
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
          <div className="flex flex-col flex-1 p-4 lg:p-6 mb-10 no-scrollbar" dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
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
                >
                  {isNewReferral ? "שמור הפניה" : (isEditing ? "שמור שינויים" : "ערוך הפניה")}
                </Button>
              </div>
            </div>

            <Card className="w-full p-4 pt-3 shadow-md border-none">
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
                  showClear={true}
                />
              )}
              <CompactPrescriptionTab
                data={compactPrescriptionFormData}
                onChange={(field, value) => handleCompactPrescriptionChange(field as keyof CompactPrescriptionExam, value)}
                isEditing={isEditing}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-start">
              <Card className="px-4 pt-3 pb-4 shadow-md border-none gap-2" dir="rtl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10,9 9,9 8,9"></polyline>
                    </svg>
                  </div>
                  <h3 className="text-base font-medium text-muted-foreground">הערות</h3>
                </div>
                <textarea
                  name="referral_notes"
                  disabled={!isEditing}
                  value={formData.referral_notes || ''}
                  onChange={handleInputChange}
                  className={`text-sm w-full p-3 border rounded-lg ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default min-h-[90px]`}
                  rows={4}
                  placeholder="הערות להפניה..."
                />
              </Card>
              <Card className="px-4 pt-3 pb-4 shadow-md border-none gap-2" dir="rtl">
              <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10,9 9,9 8,9"></polyline>
                    </svg>
                  </div>
                  <h3 className="text-base font-medium text-muted-foreground">הערות מרשם</h3>
                </div>
                <textarea
                  name="prescription_notes"
                  disabled={!isEditing}
                  value={formData.prescription_notes || ''}
                  onChange={handleInputChange}
                  className={`text-sm w-full p-3 border rounded-lg ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default min-h-[90px]`}
                  rows={4}
                  placeholder="הערות למרשם..."
                />
              </Card>
            </div>
          </div>
        </div>
      </ClientSpaceLayout>
    </>
  )
} 