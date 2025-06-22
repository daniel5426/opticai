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

export default function ReferralDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<Client | null>(null)
  
  // Check if we're on the create route
  const isNewReferral = location.pathname === '/referrals/create'
  
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
    comb_va: 0,
    comb_high: 0,
    comb_pd: 0,
    date: '',
    type: '',
    branch: '',
    recipient: ''
  })

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

  useEffect(() => {
    const loadReferralData = async () => {
      try {
        setLoading(true)
        
        // Load client data first
        const clientId = isNewReferral ? clientIdFromSearch : formData.client_id?.toString()
        if (clientId) {
          const clientData = await getClientById(Number(clientId))
          setClient(clientData || null)
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
  }, [referralId, isNewReferral, clientIdFromSearch])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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

        // Always save eye data (create or update)
        const [savedRightEye, savedLeftEye] = await Promise.all([
          rightEyeData.id ? updateReferralEye(rightEyeToSave) : createReferralEye(rightEyeToSave),
          leftEyeData.id ? updateReferralEye(leftEyeToSave) : createReferralEye(leftEyeToSave)
        ])

        if (savedRightEye && savedLeftEye) {
          toast.success("ההפניה נשמרה בהצלחה")
          
          if (isNewReferral) {
            // Navigate back to client's referrals tab after creating
            if (clientIdFromSearch) {
              navigate({ to: `/clients/${clientIdFromSearch}`, search: { tab: 'referrals' } })
            } else {
              navigate({ to: `/referrals/${savedReferral.id}` })
            }
          } else {
            // Navigate back to client's referrals tab after editing
            if (formData.client_id) {
              navigate({ to: `/clients/${formData.client_id}`, search: { tab: 'referrals' } })
            }
          }
        } else {
          toast.error("שגיאה בשמירת נתוני העיניים")
        }
      } else {
        toast.error("שגיאה בשמירת ההפניה")
      }
    } catch (error) {
      console.error('Error saving referral:', error)
      toast.error("שגיאה בשמירת ההפניה")
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
          clientName={client ? `${client.first_name} ${client.last_name}`.trim() : ''}
          clientBackLink={clientIdFromSearch ? `/clients/${clientIdFromSearch}` : "/clients"}
          examInfo="הפניה"
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
          clientName={fullName}
          clientBackLink={clientIdFromSearch || formData.client_id ? `/clients/${clientIdFromSearch || formData.client_id}` : "/clients"}
          examInfo={isNewReferral ? "הפניה חדשה" : `הפניה מס' ${referralId}`}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">
                {isNewReferral ? 'הפניה חדשה' : 'פרטי הפניה'}
              </h1>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  ביטול
                </Button>
                <Button onClick={handleSave}>
                  שמור
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 p-4 rounded-lg">
              <div>
                <Label className="font-semibold text-base">תאריך</Label>
                <div className="h-1"></div>
                <Input
                  type="date"
                  name="date"
                  value={formData.date || ''}
                  onChange={handleInputChange}
                />
              </div>
              <div>
                <Label className="font-semibold text-base">סוג הפניה</Label>
                <div className="h-1"></div>
                <Input
                  name="type"
                  value={formData.type || ''}
                  onChange={handleInputChange}
                  placeholder="סוג ההפניה"
                />
              </div>
              <div>
                <Label className="font-semibold text-base">סניף</Label>
                <div className="h-1"></div>
                <Input
                  name="branch"
                  value={formData.branch || ''}
                  onChange={handleInputChange}
                  placeholder="סניף"
                />
              </div>
              <div>
                <Label className="font-semibold text-base">נמען</Label>
                <div className="h-1"></div>
                <Input
                  name="recipient"
                  value={formData.recipient || ''}
                  onChange={handleInputChange}
                  placeholder="נמען ההפניה"
                />
              </div>
            </div>

            {/* Eye Data Section - Same layout as ExamDetailPage */}
            <div className="border rounded-lg p-4">              
              {/* Header Row */}
              <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                <div className="grid grid-cols-16 gap-4 flex-1 pb-2" dir="ltr">
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">SPH</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">CYL</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">AXIS</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">PRIS</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">BASE</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">VA</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">ADD</Label>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-[12px] block text-center">PD</Label>
                  </div>
                </div>
                <span className="text-md font-medium pr-2 flex items-center justify-center w-6"></span>
              </div>

              {/* Right Eye Row */}
              <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                <div className="grid grid-cols-16 gap-4 flex-1 pb-2" dir="ltr">
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.25" 
                      value={rightEyeData.sph?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, sph: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.25" 
                      value={rightEyeData.cyl?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, cyl: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      min="0" 
                      max="180" 
                      value={rightEyeData.ax?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, ax: parseInt(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.5" 
                      value={rightEyeData.pris?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, pris: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={rightEyeData.base?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, base: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={rightEyeData.va?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, va: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.25" 
                      value={rightEyeData.add?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, add: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={rightEyeData.pd?.toString() || ""} 
                      onChange={(e) => setRightEyeData(prev => ({ ...prev, pd: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                </div>
                <span className="text-md font-medium pr-2 flex items-center justify-center w-6 pt-2">R</span>
              </div>

              {/* Combined Fields Row */}
              <div className="flex items-center gap-1 h-10 mb-3" dir="rtl">
                <div className="grid grid-cols-16 gap-4 flex-1" dir="ltr">
                  <div className="col-span-2"></div>
                  <div className="col-span-2"></div>
                  <div className="col-span-2"></div>
                  <div className="col-span-2"></div>
                  <div className="col-span-2"></div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={formData.comb_va?.toString() || ""} 
                      onChange={(e) => setFormData(prev => ({ ...prev, comb_va: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="Comb VA" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={formData.comb_high?.toString() || ""} 
                      onChange={(e) => setFormData(prev => ({ ...prev, comb_high: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="High" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={formData.comb_pd?.toString() || ""} 
                      onChange={(e) => setFormData(prev => ({ ...prev, comb_pd: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="PD" 
                    />
                  </div>
                </div>
                <span className="text-md font-medium pr-2 flex items-center justify-center w-6">C</span>
              </div>

              {/* Left Eye Row */}
              <div className="flex items-center gap-1 h-6 mb-3" dir="rtl">
                <div className="grid grid-cols-16 gap-4 flex-1 pb-2" dir="ltr">
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.25" 
                      value={leftEyeData.sph?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, sph: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.25" 
                      value={leftEyeData.cyl?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, cyl: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      min="0" 
                      max="180" 
                      value={leftEyeData.ax?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, ax: parseInt(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.5" 
                      value={leftEyeData.pris?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, pris: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={leftEyeData.base?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, base: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={leftEyeData.va?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, va: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.25" 
                      value={leftEyeData.add?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, add: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.00" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      step="0.1" 
                      value={leftEyeData.pd?.toString() || ""} 
                      onChange={(e) => setLeftEyeData(prev => ({ ...prev, pd: parseFloat(e.target.value) || 0 }))}
                      className="h-8 text-xs px-1" 
                      placeholder="0.0" 
                    />
                  </div>
                </div>
                <span className="text-md font-medium pr-2 flex items-center justify-center w-6 pb-2">L</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold text-base">הערות הפניה</Label>
                <div className="h-1"></div>
                <Textarea
                  name="referral_notes"
                  value={formData.referral_notes || ''}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="הערות להפניה..."
                />
              </div>
              <div>
                <Label className="font-semibold text-base">הערות מרשם</Label>
                <div className="h-1"></div>
                <Textarea
                  name="prescription_notes"
                  value={formData.prescription_notes || ''}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="הערות למרשם..."
                />
              </div>
            </div>
          </div>
        </div>
      </>
    )
} 