import React from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { getClientById } from "@/lib/db/clients-db"
import { ContactLens, ContactEye, ContactLensOrder } from "@/lib/db/schema"
import { toast } from "sonner"
import ContactLensDetailPage from "./ContactLensDetailPage"

export default function ContactLensCreatePage() {
  const { clientId } = useParams({ from: "/clients/$clientId/contact-lenses/new" })
  const client = getClientById(Number(clientId))
  const navigate = useNavigate()

  const handleSave = (contactLens: ContactLens, rightEye: ContactEye, leftEye: ContactEye, contactLensOrder: ContactLensOrder) => {
    navigate({ to: `/clients/${clientId}`, search: { tab: 'contact-lenses' } })
  }

  const handleCancel = () => {
    navigate({ to: `/clients/${clientId}` })
  }
  
  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl">לקוח לא נמצא</h1>
      </div>
    )
  }

  return (
    <ContactLensDetailPage
      mode="new"
      clientId={clientId}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
} 