import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAllClients } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"
import { useNavigate } from "@tanstack/react-router"

interface ClientSelectModalProps {
  triggerText: string
  onClientSelect: (clientId: number) => void
  variant?: "default" | "table"
}

export function ClientSelectModal({ triggerText, onClientSelect, variant = "default" }: ClientSelectModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const loadClients = async () => {
      if (isModalOpen && clients.length === 0) {
        try {
          setLoading(true)
          const clientsData = await getAllClients()
          setClients(clientsData)
        } catch (error) {
          console.error('Error loading clients:', error)
        } finally {
          setLoading(false)
        }
      }
    }

    loadClients()
  }, [isModalOpen, clients.length])

  // Filter clients based on search query
  const filteredClients = clients.filter(client => {
    const fullName = `${client.first_name} ${client.last_name}`.toLowerCase()
    const phone = client.phone_mobile?.toLowerCase() || ""
    const email = client.email?.toLowerCase() || ""
    const search = searchQuery.toLowerCase()
    
    return fullName.includes(search) || phone.includes(search) || email.includes(search)
  })

  const handleClientSelect = (clientId: number) => {
    setIsModalOpen(false)
    setSearchQuery("")
    onClientSelect(clientId)
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button>{triggerText}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>בחר לקוח</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="חיפוש לקוח..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            dir="rtl"
          />
          <div className="max-h-[300px] overflow-y-auto" style={{scrollbarWidth: 'none'}}>
            {loading ? (
              <div className="flex justify-center items-center h-20">
                <div className="text-lg">טוען לקוחות...</div>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="flex justify-center items-center h-20">
                <div className="text-gray-500">לא נמצאו לקוחות</div>
              </div>
            ) : (
              filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="p-3 border rounded-md cursor-pointer hover:bg-gray-50 mb-2"
                  onClick={() => handleClientSelect(client.id!)}
                >
                  <div className="font-medium">
                    {client.first_name} {client.last_name}
                  </div>
                  {client.phone_mobile && (
                    <div className="text-sm text-gray-500">{client.phone_mobile}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 