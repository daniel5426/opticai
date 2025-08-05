import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAllAppointments } from "@/lib/db/appointments-db"
import { getAllClients } from "@/lib/db/clients-db"
import { Appointment, Client } from "@/lib/db/schema-interface"
import { AppointmentsTable } from "@/components/appointments-table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useUser } from "@/contexts/UserContext"

export default function AllAppointmentsPage() {
  const { currentClinic } = useUser()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [appointmentsData, clientsData] = await Promise.all([
        getAllAppointments(currentClinic?.id),
        getAllClients(currentClinic?.id)
      ])
      setAppointments(appointmentsData)
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

  const handleAppointmentDeleted = (deletedAppointmentId: number) => {
    setAppointments(prevAppointments => prevAppointments.filter(appointment => appointment.id !== deletedAppointmentId))
  }

  const handleAppointmentDeleteFailed = () => {
    loadData()
  }

  // Filter clients based on search query
  const filteredClients = clients.filter(client => {
    const fullName = `${client.first_name} ${client.last_name}`.toLowerCase()
    const phone = client.phone_mobile?.toLowerCase() || ""
    const email = client.email?.toLowerCase() || ""
    const search = searchQuery.toLowerCase()
    
    return fullName.includes(search) || phone.includes(search) || email.includes(search)
  })

  const handleClientSelect = (clientId: number) => {
    setSelectedClientId(clientId)
    setIsModalOpen(false)
    // The AppointmentsTable component should handle creating new appointments
    // when selectedClientId is set
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
          clientId={selectedClientId || 0} 
          onAppointmentChange={handleAppointmentChange}
          onAppointmentDeleted={handleAppointmentDeleted}
          onAppointmentDeleteFailed={handleAppointmentDeleteFailed}
          loading={loading}
        />
      </div>
    </>
  )
} 