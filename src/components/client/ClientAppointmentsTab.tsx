import React from "react"
import { useParams } from "@tanstack/react-router"
import { AppointmentsTable } from "@/components/appointments-table"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientAppointmentsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { appointments, loading, removeAppointment, refreshAppointments } = useClientData()

  const handleAppointmentChange = () => {
    refreshAppointments()
  }

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    removeAppointment(deletedAppointmentId)
  }

  const handleAppointmentDeleteFailed = () => {
    refreshAppointments()
  }

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <AppointmentsTable 
        data={appointments} 
        clientId={Number(clientId)} 
        onAppointmentChange={handleAppointmentChange} 
        onAppointmentDeleted={handleAppointmentDeleted}
        onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
        loading={loading.appointments}
      />
    </div>
  )
} 