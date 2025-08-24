import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedReferrals } from "@/lib/db/referral-db"
import { Referral } from "@/lib/db/schema-interface"
import { ReferralTable } from "@/components/referral-table"
import { useNavigate } from "@tanstack/react-router"
import { useUser } from "@/contexts/UserContext"

export default function AllReferralsPage() {
  const { currentClinic } = useUser()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const { items, total } = await getPaginatedReferrals(currentClinic?.id, { limit: pageSize, offset, order: 'date_desc' })
      setReferrals(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [currentClinic, page, pageSize])

  const handleReferralDeleted = (deletedReferralId: number) => {
    setReferrals(prevReferrals => prevReferrals.filter(referral => referral.id !== deletedReferralId))
    // Move to previous page if we deleted the last item on the current page
    if (referrals.length === 1 && page > 1) {
      setPage(page - 1)
    } else {
      setTotal(prev => prev - 1)
    }
  }

  const handleReferralDeleteFailed = () => {
    loadData()
  }

  const handleClientSelect = (clientId: number) => {
    navigate({ to: "/clients/$clientId/referrals/new", params: { clientId: String(clientId) } })
  }

  return (
    <>
      <SiteHeader title="הפניות" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">כל ההפניות</h1>
        </div>
        <ReferralTable 
          referrals={referrals} 
          onReferralDeleted={handleReferralDeleted} 
          onReferralDeleteFailed={handleReferralDeleteFailed}
          clientId={0}
          loading={loading}
          pagination={{ page, pageSize, total, setPage }}
        />
      </div>
    </>
  )
} 