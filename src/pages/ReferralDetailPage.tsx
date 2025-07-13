import React, { useState, useEffect } from "react"
import { useParams, useNavigate, useSearch, useLocation } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Referral, ReferralEye, Client } from "@/lib/db/schema"
import {
  getReferralById,
  updateReferral,
  createReferral,
  getReferralEyesByReferralId,
  createReferralEye,
  updateReferralEye
} from "@/lib/db/referral-db"
import { getClientById } from "@/lib/db/clients-db"
import { toast } from "sonner"
import { CompactPrescriptionTab } from "@/components/exam/CompactPrescriptionTab"
import { ExamToolbox, createToolboxActions } from "@/components/exam/ExamToolbox"
import { ExamFieldMapper, ExamComponentType } from "@/lib/exam-field-mappings"
import { copyToClipboard, pasteFromClipboard, getClipboardContentType } from "@/lib/exam-clipboard"
import { CompactPrescriptionExam } from "@/lib/db/schema"
import {
  createCompactPrescriptionExam,
  updateCompactPrescriptionExam,
  getCompactPrescriptionExamByReferralId
} from "@/lib/db/compact-prescription-db"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"

export default function ReferralDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState('referrals')

  // Check if we're on the create route
  const isNewReferral = location.pathname === '/referrals/create'
  const [isEditing, setIsEditing] = useState(isNewReferral)

  // Get referralId for detail route, or search params for create route
  let referralId: string | undefined
  let clientIdFromSearch: string | undefined

  if (isNewReferral) {
    try {
      const searchParams = useSearch({ from: "/referrals/create" })
      clientIdFromSearch = searchParams.clientId
    } catch (error) {
      // Fallback to URL search params if hook fails
      const urlParams = new URLSearchParams(window.location.search)
      clientIdFromSearch = urlParams.get('clientId') || undefined
    }
  } else {
    const params = useParams({ from: "/referrals/$referralId" })
    referralId = params.referralId
  }

  const [formData, setFormData] = useState<Referral>({
    client_id: 0,
    referral_notes: '',
    prescription_notes: '',
    date: '',
    type: '',
    branch: '',
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

    const copiedData = ExamFieldMapper.copyData(sourceData, compactPrescriptionFormData, sourceType, type)

    Object.entries(copiedData).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        handleCompactPrescriptionChange(key as keyof CompactPrescriptionExam, String(value))
      }
    })

    toast.success("נתונים הודבקו בהצלחה")
  }

  const [rightEyeData, setRightEyeData] = useState<ReferralEye>({
    referral_id: 0,
    eye: 'R',
    sph: undefined,
    cyl: undefined,
    ax: undefined,
    pris: undefined,
    base: undefined,
    va: undefined,
    add: undefined,
    decent: undefined,
    s_base: undefined,
    high: undefined,
    pd: undefined
  })

  const [leftEyeData, setLeftEyeData] = useState<ReferralEye>({
    referral_id: 0,
    eye: 'L',
    sph: undefined,
    cyl: undefined,
    ax: undefined,
    pris: undefined,
    base: undefined,
    va: undefined,
    add: undefined,
    decent: undefined,
    s_base: undefined,
    high: undefined,
    pd: undefined
  })

  const { currentClient } = useClientSidebar()

  useEffect(() => {
    const loadReferralData = async () => {
      try {
        setLoading(true)

        // Load client data first
        const clientId = isNewReferral ? clientIdFromSearch : formData.client_id?.toString()
        if (clientId) {
          const clientData = await getClientById(Number(clientId))
          setClient(clientData || null)
        } else if (currentClient) {
          setClient(currentClient)
        }

        if (isNewReferral) {
          if (clientIdFromSearch) {
            setFormData(prev => ({ ...prev, client_id: Number(clientIdFromSearch) }))
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

          // Load compact prescription
          const compactPrescriptionData = await getCompactPrescriptionExamByReferralId(Number(referralId))
          if (compactPrescriptionData) {
            setCompactPrescription(compactPrescriptionData)
            setCompactPrescriptionFormData(compactPrescriptionData)
          } else {
            setCompactPrescriptionFormData(prev => ({ ...prev, referral_id: Number(referralId) }))
          }

          const eyeData = await getReferralEyesByReferralId(Number(referralId))
          const rightEye = eyeData.find(eye => eye.eye === 'R')
          const leftEye = eyeData.find(eye => eye.eye === 'L')

          if (rightEye) {
            setRightEyeData(rightEye)
          } else {
            setRightEyeData(prev => ({ ...prev, referral_id: Number(referralId) }))
          }

          if (leftEye) {
            setLeftEyeData(leftEye)
          } else {
            setLeftEyeData(prev => ({ ...prev, referral_id: Number(referralId) }))
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
  }, [referralId, isNewReferral, clientIdFromSearch, currentClient])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCompactPrescriptionChange = (field: keyof CompactPrescriptionExam, value: any) => {
    setCompactPrescriptionFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleTabChange = (value: string) => {
    const clientId = isNewReferral ? clientIdFromSearch : formData.client_id?.toString()
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
      let savedReferral

      if (isNewReferral) {
        savedReferral = await createReferral(formData)
      } else {
        savedReferral = await updateReferral(formData)
      }

      if (savedReferral) {
        const referralIdToUse = savedReferral.id!

        const rightEyeToSave = { ...rightEyeData, referral_id: referralIdToUse }
        const leftEyeToSave = { ...leftEyeData, referral_id: referralIdToUse }
        const compactPrescriptionToSave = { ...compactPrescriptionFormData, referral_id: referralIdToUse }

        // Always save eye data and compact prescription (create or update)
        const [savedRightEye, savedLeftEye, savedCompactPrescription] = await Promise.all([
          rightEyeData.id ? updateReferralEye(rightEyeToSave) : createReferralEye(rightEyeToSave),
          leftEyeData.id ? updateReferralEye(leftEyeToSave) : createReferralEye(leftEyeToSave),
          compactPrescription?.id ? updateCompactPrescriptionExam(compactPrescriptionToSave) : createCompactPrescriptionExam(compactPrescriptionToSave)
        ])

        if (savedRightEye && savedLeftEye && savedCompactPrescription) {
          toast.success("ההפניה נשמרה בהצלחה")

          if (isNewReferral) {
            // Navigate back to client's referrals tab after creating
            if (clientIdFromSearch) {
              navigate({ to: `/clients/${clientIdFromSearch}`, search: { tab: 'referrals' } })
            } else {
              navigate({ to: `/referrals/${savedReferral.id}` })
            }
          } else {
            // For edit mode, stay on the page but switch to view mode
            setIsEditing(false)
            // Update the form data with the saved data
            setFormData(savedReferral)
          }
        } else {
          toast.error("שגיאה בשמירת נתוני העיניים או המרשם")
        }
      } else {
        toast.error("שגיאה בשמירת ההפניה")
      }
    } catch (error) {
      console.error('Error saving referral:', error)
      toast.error("שגיאה בשמירת ההפניה")
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
    if (isNewReferral && clientIdFromSearch) {
      navigate({ to: `/clients/${clientIdFromSearch}`, search: { tab: 'referrals' } })
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
          clientBackLink={clientIdFromSearch || formData.client_id ? `/clients/${clientIdFromSearch || formData.client_id}` : "/clients"}
          examInfo="הפניה"
          tabs={{
            activeTab,
            onTabChange: handleTabChange
          }}
        />
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-lg">טוען נתוני הפניה...</div>
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
        clientBackLink={clientIdFromSearch || formData.client_id ? `/clients/${clientIdFromSearch || formData.client_id}` : "/clients"}
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
                  <label className="font-semibold text-base">סניף</label>
                  <div className="h-1"></div>
                  <Input
                    name="branch"
                    value={formData.branch || ''}
                    onChange={handleInputChange}
                    placeholder="סניף"
                    disabled={!isEditing}
                    className={`h-9 text-sm ${isEditing ? 'bg-white' : 'bg-accent/50'} disabled:opacity-100 disabled:cursor-default`}
                  />
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
                onChange={handleCompactPrescriptionChange}
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