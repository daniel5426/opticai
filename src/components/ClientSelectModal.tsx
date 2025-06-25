import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAllClients } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"
import { useNavigate } from "@tanstack/react-router"
import { CustomModal } from "@/components/ui/custom-modal"

interface ClientSelectModalProps {
  triggerText?: string
  onClientSelect: (clientId: number) => void
  variant?: "default" | "table"
  isOpen?: boolean
  onClose?: () => void
}

export function ClientSelectModal({ triggerText, onClientSelect, variant = "default", isOpen, onClose }: ClientSelectModalProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [internalOpen, setInternalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)

  const isControlled = isOpen !== undefined
  const modalOpen = isControlled ? !!isOpen : internalOpen

  useEffect(() => {
    const loadClients = async () => {
      if (modalOpen && clients.length === 0) {
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
  }, [modalOpen, clients.length])

  // Cleanup when component unmounts or modal closes
  useEffect(() => {
    if (!modalOpen) {
      setSearchQuery("")
      setLoading(false)
    }
  }, [modalOpen])

  // Filter clients based on search query
  const filteredClients = clients.filter(client => {
    const fullName = `${client.first_name} ${client.last_name}`.toLowerCase()
    const phone = client.phone_mobile?.toLowerCase() || ""
    const email = client.email?.toLowerCase() || ""
    const search = searchQuery.toLowerCase()
    
    return fullName.includes(search) || phone.includes(search) || email.includes(search)
  })

  const handleClientSelect = (clientId: number) => {
    setSearchQuery("")
    onClientSelect(clientId)
    // Close the modal after selection
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
  }

  const handleModalClose = () => {
    if (isControlled) {
      onClose?.()
    } else {
      setInternalOpen(false)
    }
    setSearchQuery("")
  }

  const handleTriggerClick = () => {
    if (!isControlled) {
      setInternalOpen(true)
    }
  }

  return (
    <>
      {triggerText && (
        <Button onClick={handleTriggerClick}>{triggerText}</Button>
      )}
      
      <CustomModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        title="בחר לקוח"
      >
        <div className="space-y-4 w-md">
          <Input
            placeholder="חיפוש לקוח..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            dir="rtl"
            autoFocus={false}
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
                  key={`client-${client.id}`}
                  className="p-3 border rounded-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 mb-2"
                  onClick={() => handleClientSelect(client.id!)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleClientSelect(client.id!)
                    }
                  }}
                  tabIndex={0}
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
      </CustomModal>
    </>
  )
} 