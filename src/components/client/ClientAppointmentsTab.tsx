import React from "react"
import { useParams } from "@tanstack/react-router"
import { AppointmentsTable } from "@/components/appointments-table"
import { useQueryClient } from "@tanstack/react-query"
import {
  clientQueryKeys,
  removeQueryItemById,
  useClientAppointmentsQuery,
} from "@/hooks/client/useClientTabQueries"
import { Appointment } from "@/lib/db/schema-interface"

interface ClientAppointmentsTabProps {
  enabled?: boolean
}

export function ClientAppointmentsTab({ enabled = true }: ClientAppointmentsTabProps) {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const clientIdNum = Number(clientId)
  const queryClient = useQueryClient()
  const appointmentsQuery = useClientAppointmentsQuery(clientIdNum, enabled)
  const queryKey = clientQueryKeys.appointments(clientIdNum)

  const handleAppointmentChange = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    queryClient.setQueryData<Appointment[]>(queryKey, (current) =>
      removeQueryItemById(current, deletedAppointmentId),
    )
  }

  const handleAppointmentDeleteFailed = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <AppointmentsTable 
        data={appointmentsQuery.data || []} 
        clientId={clientIdNum} 
        onAppointmentChange={handleAppointmentChange} 
        onAppointmentDeleted={handleAppointmentDeleted}
        onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
        loading={appointmentsQuery.isLoading}
      />
    </div>
  )
} 
