import React from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import ExamDetailPage from "./ExamDetailPage"

export default function ContactLensCreatePage() {
  const { clientId } = useParams({ from: "/clients/$clientId/contact-lenses/new" })
  const navigate = useNavigate()

  const handleSave = () => {
    navigate({ to: "/clients/$clientId", params: { clientId } })
  }

  const handleCancel = () => {
    navigate({ to: "/clients/$clientId", params: { clientId } })
  }

  return (
    <ExamDetailPage
      mode="new"
      clientId={clientId}
      pageType="contact-lens"
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
} 