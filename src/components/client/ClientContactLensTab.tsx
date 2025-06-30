import React from "react"
import { useParams } from "@tanstack/react-router"
import { ContactLens } from "@/lib/db/schema"
import { ContactLensTable } from "@/components/contact-lens-table"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientContactLensTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { contactLenses, loading, refreshContactLenses } = useClientData()
  const [currentContactLenses, setCurrentContactLenses] = React.useState<ContactLens[]>(contactLenses)

  React.useEffect(() => {
    setCurrentContactLenses(contactLenses)
  }, [contactLenses])

  const handleContactLensDeleted = (deletedContactLensId: number) => {
    setCurrentContactLenses(prevContactLenses => prevContactLenses.filter(cl => cl.id !== deletedContactLensId))
  }

  const handleContactLensDeleteFailed = () => {
    refreshContactLenses()
  }


  return (
    <ContactLensTable 
      data={currentContactLenses} 
      clientId={Number(clientId)} 
      onContactLensDeleted={handleContactLensDeleted}
      onContactLensDeleteFailed={handleContactLensDeleteFailed}
      loading={loading.contactLenses}
    />
  )
}