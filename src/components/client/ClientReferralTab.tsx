import React, { useState, useEffect } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"
import { ReferralTable } from "@/components/referral-table"
import { getReferralsByClientId } from "@/lib/db/referral-db"
import { Referral } from "@/lib/db/schema"
import { Plus } from "lucide-react"

export function ClientReferralTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)

  const loadReferrals = async () => {
    try {
      setLoading(true)
      const referralData = await getReferralsByClientId(Number(clientId))
      setReferrals(referralData)
    } catch (error) {
      console.error('Error loading referrals:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReferrals()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">טוען הפניות...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <div className="flex justify-between items-center" dir="rtl">
        <h3 className="text-lg font-semibold">הפניות</h3>
        <Link to="/referrals/create" search={{ clientId }}>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            הפניה חדשה
          </Button>
        </Link>
      </div>
      
      <ReferralTable 
        referrals={referrals} 
        onRefresh={loadReferrals}
      />
    </div>
  )
} 