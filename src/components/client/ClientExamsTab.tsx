import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ExamsTable } from "@/components/exams-table"
import { getExamsByClientId } from "@/lib/db/exams-db"
import { useParams } from "@tanstack/react-router"

export function ClientExamsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const exams = getExamsByClientId(Number(clientId))

  return (
      <ExamsTable data={exams} clientId={Number(clientId)} />
  )
} 