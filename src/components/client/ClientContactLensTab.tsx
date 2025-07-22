import React from "react"
import { useParams } from "@tanstack/react-router"
import { ContactLensTable } from "@/components/contact-lens-table"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientContactLensTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { contactLenses, loading, removeContactLens, refreshContactLenses } = useClientData()

  const handleExamDeleted = (deletedContactLensId: number) => {
    removeContactLens(deletedContactLensId)
  }

  const handleExamDeleteFailed = () => {
    refreshContactLenses()
  }

  return (
    <ContactLensTable 
      data={contactLenses} 
      clientId={Number(clientId)} 
      onExamDeleted={handleExamDeleted}
      onExamDeleteFailed={handleExamDeleteFailed}
      loading={loading.contactLenses}
    />
  )
}