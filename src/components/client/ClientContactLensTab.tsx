import React, { useState, useEffect } from "react"
import { ContactLensTable } from "@/components/contact-lens-table"
import { getContactLensesByClientId } from "@/lib/db/contact-lens-db"
import { useParams } from "@tanstack/react-router"
import { ContactLens } from "@/lib/db/schema"

export function ClientContactLensTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [contactLenses, setContactLenses] = useState<ContactLens[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadContactLenses = async () => {
      try {
        setLoading(true)
        const contactLensesData = await getContactLensesByClientId(Number(clientId))
        setContactLenses(contactLensesData)
      } catch (error) {
        console.error('Error loading contact lenses:', error)
      } finally {
        setLoading(false)
      }
    }

    loadContactLenses()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-lg">טוען עדשות מגע...</div>
      </div>
    )
  }

  return (
    <ContactLensTable data={contactLenses} clientId={Number(clientId)} />
  )
}