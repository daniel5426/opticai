import React, { useState, useEffect } from "react"
import { useParams } from "@tanstack/react-router"
import { AppointmentsTable } from "@/components/appointments-table"
import { getAppointmentsByClient } from "@/lib/db/appointments-db"
import { Appointment } from "@/lib/db/schema"

export function ClientAppointmentsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  const loadAppointments = async () => {
    try {
      setLoading(true)
      const appointmentsData = await getAppointmentsByClient(Number(clientId))
      setAppointments(appointmentsData)
    } catch (error) {
      console.error('Error loading appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointments()
  }, [clientId])

  const handleAppointmentChange = () => {
    loadAppointments()
  }

  if (loading) {
    return <div>טוען תורים...</div>
  }

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <AppointmentsTable 
        data={appointments} 
        clientId={Number(clientId)} 
        onAppointmentChange={handleAppointmentChange} 
      />
    </div>
  )
} 