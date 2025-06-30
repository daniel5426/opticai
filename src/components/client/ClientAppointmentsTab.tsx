import React from "react"
import { useParams } from "@tanstack/react-router"
import { AppointmentsTable } from "@/components/appointments-table"
import { useClientData } from "@/contexts/ClientDataContext"
import { Appointment } from "@/lib/db/schema"

export function ClientAppointmentsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { appointments, loading, refreshAppointments } = useClientData()
  const [currentAppointments, setCurrentAppointments] = React.useState<Appointment[]>(appointments)

  React.useEffect(() => {
    setCurrentAppointments(appointments)
  }, [appointments])

  const handleAppointmentChange = () => {
    refreshAppointments()
  }

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    setCurrentAppointments(prevAppointments => prevAppointments.filter(appointment => appointment.id !== deletedAppointmentId))
  }

  const handleAppointmentDeleteFailed = () => {
    refreshAppointments()
  }


  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <AppointmentsTable 
        data={currentAppointments} 
        clientId={Number(clientId)} 
        onAppointmentChange={handleAppointmentChange} 
        onAppointmentDeleted={handleAppointmentDeleted}
        onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
        loading={loading.appointments}
      />
    </div>
  )
} 