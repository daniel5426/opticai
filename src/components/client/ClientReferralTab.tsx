import React from "react"
import { useParams } from "@tanstack/react-router"
import { ReferralTable } from "@/components/referral-table"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientReferralTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { referrals, loading, removeReferral, refreshReferrals } = useClientData()

  const handleReferralDeleted = (deletedReferralId: number) => {
    removeReferral(deletedReferralId)
  }

  const handleReferralDeleteFailed = () => {
    refreshReferrals()
  }

  return (
    <ReferralTable 
      referrals={referrals} 
      onReferralDeleted={handleReferralDeleted}
      onReferralDeleteFailed={handleReferralDeleteFailed}
      clientId={Number(clientId)}
      loading={loading.referrals}
    />
  )
} 