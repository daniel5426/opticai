import React from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { getClientById } from "@/lib/db/clients-db"
import { OpticalExam, OpticalEyeExam } from "@/lib/db/schema"
import { toast } from "sonner"
import ExamDetailPage from "./ExamDetailPage"

export default function ExamCreatePage() {
  const { clientId } = useParams({ from: "/clients/$clientId/exams/new" })
  const client = getClientById(Number(clientId))
  const navigate = useNavigate()

  const handleSave = (exam: OpticalExam, rightEyeExam: OpticalEyeExam, leftEyeExam: OpticalEyeExam) => {
    navigate({ to: `/clients/${clientId}` })
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
    <ExamDetailPage
      mode="new"
      clientId={clientId}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
} 