import React from "react"
import { useParams } from "@tanstack/react-router"
import { ContactLensTable } from "@/components/contact-lens-table"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientContactLensTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { contactLenses, loading, removeContactLens, refreshContactLenses } = useClientData()

  const handleContactLensDeleted = (deletedContactLensId: number) => {
    removeContactLens(deletedContactLensId)
  }

  const handleContactLensDeleteFailed = () => {
    refreshContactLenses()
  }

  return (
    <ContactLensTable 
      data={contactLenses} 
      clientId={Number(clientId)} 
      onContactLensDeleted={handleContactLensDeleted}
      onContactLensDeleteFailed={handleContactLensDeleteFailed}
      loading={loading.contactLenses}
    />
  )
}