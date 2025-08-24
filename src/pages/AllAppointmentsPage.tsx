import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedAppointments } from "@/lib/db/appointments-db"
import { Appointment } from "@/lib/db/schema-interface"
import { AppointmentsTable } from "@/components/appointments-table"
import { useUser } from "@/contexts/UserContext"

export default function AllAppointmentsPage() {
  const { currentClinic } = useUser()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)

  const loadData = async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const { items, total } = await getPaginatedAppointments(currentClinic?.id, { limit: pageSize, offset, order: 'date_desc' })
      setAppointments(items)
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

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    setAppointments(prevAppointments => prevAppointments.filter(appointment => appointment.id !== deletedAppointmentId))
    // Move to previous page if we deleted the last item on the current page
    if (appointments.length === 1 && page > 1) {
      setPage(page - 1)
    } else {
      setTotal(prev => prev - 1)
    }
  }

  const handleAppointmentDeleteFailed = () => {
    loadData()
  }

  const handleAppointmentChange = () => {
    loadData()
  }

  return (
    <>
      <SiteHeader title="תורים" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">כל התורים</h1>
        </div>
        <AppointmentsTable 
          data={appointments} 
          clientId={0} 
          onAppointmentChange={handleAppointmentChange}
          onAppointmentDeleted={handleAppointmentDeleted}
          onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
          loading={loading}
          pagination={{ page, pageSize, total, setPage }}
        />
      </div>
    </>
  )
} 