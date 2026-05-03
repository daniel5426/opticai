import React from "react"
import { useParams } from "@tanstack/react-router"
import { ReferralTable } from "@/components/referral-table"
import { useQueryClient } from "@tanstack/react-query"
import {
  clientQueryKeys,
  removeQueryItemById,
  useClientReferralsQuery,
} from "@/hooks/client/useClientTabQueries"
import { Referral } from "@/lib/db/schema-interface"

interface ClientReferralTabProps {
  enabled?: boolean
}

export function ClientReferralTab({ enabled = true }: ClientReferralTabProps) {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const clientIdNum = Number(clientId)
  const queryClient = useQueryClient()
  const referralsQuery = useClientReferralsQuery(clientIdNum, enabled)
  const queryKey = clientQueryKeys.referrals(clientIdNum)

  const handleReferralDeleted = (deletedReferralId: number) => {
    queryClient.setQueryData<Referral[]>(queryKey, (current) =>
      removeQueryItemById(current, deletedReferralId),
    )
  }

  const handleReferralDeleteFailed = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  return (
    <ReferralTable 
      referrals={referralsQuery.data || []} 
      onReferralDeleted={handleReferralDeleted}
      onReferralDeleteFailed={handleReferralDeleteFailed}
      clientId={clientIdNum}
      loading={referralsQuery.isLoading}
    />
  )
} 
