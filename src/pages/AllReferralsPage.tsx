import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAllReferrals } from "@/lib/db/referral-db"
import { getAllClients } from "@/lib/db/clients-db"
import { Referral, Client } from "@/lib/db/schema-interface"
import { ReferralTable } from "@/components/referral-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"
import { useUser } from "@/contexts/UserContext"

export default function AllReferralsPage() {
  const { currentClinic } = useUser()
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      setLoading(true)
      const [referralsData, clientsData] = await Promise.all([
        getAllReferrals(currentClinic?.id),
        getAllClients(currentClinic?.id)
      ])
      setReferrals(referralsData)
      setClients(clientsData)
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
  }, [currentClinic])

  const handleReferralDeleted = (deletedReferralId: number) => {
    setReferrals(prevReferrals => prevReferrals.filter(referral => referral.id !== deletedReferralId))
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
        />
      </div>
    </>
  )
} 