import React from "react"
import { useParams } from "@tanstack/react-router"
import { ReferralTable } from "@/components/referral-table"
import { useClientData } from "@/contexts/ClientDataContext"
import { Referral } from "@/lib/db/schema"

export function ClientReferralTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { referrals, loading, refreshReferrals } = useClientData()
  const [currentReferrals, setCurrentReferrals] = React.useState<Referral[]>(referrals)

  React.useEffect(() => {
    setCurrentReferrals(referrals)
  }, [referrals])

  const handleReferralDeleted = (deletedReferralId: number) => {
    setCurrentReferrals(prevReferrals => prevReferrals.filter(referral => referral.id !== deletedReferralId))
  }

  const handleReferralDeleteFailed = () => {
    refreshReferrals()
  }


  return (
    <ReferralTable 
      referrals={currentReferrals} 
      onReferralDeleted={handleReferralDeleted}
      onReferralDeleteFailed={handleReferralDeleteFailed}
      clientId={Number(clientId)}
      loading={loading.referrals}
    />
  )
} 