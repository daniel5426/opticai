import React from "react"
import { ExamsTable } from "@/components/exams-table"
import { useParams } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/contexts/UserContext"
import {
  clientQueryKeys,
  removeQueryItemById,
  useClientExamsQuery,
  useUsersQuery,
} from "@/hooks/client/useClientTabQueries"
import { OpticalExam } from "@/lib/db/schema-interface"

interface ClientExamsTabProps {
  enabled?: boolean
}

export function ClientExamsTab({ enabled = true }: ClientExamsTabProps) {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const clientIdNum = Number(clientId)
  const queryClient = useQueryClient()
  const { currentClinic } = useUser()
  const examsQuery = useClientExamsQuery(clientIdNum, "exam", enabled)
  const usersQuery = useUsersQuery(currentClinic?.id, enabled)
  const usersById = React.useMemo(() => {
    return new Map((usersQuery.data || []).map((user) => [user.id, user]))
  }, [usersQuery.data])
  const client = queryClient.getQueryData<any>(clientQueryKeys.client(clientIdNum))
  const clientName = client ? `${client.first_name || ""} ${client.last_name || ""}`.trim() : ""
  const exams = React.useMemo(() => {
    return (examsQuery.data || []).map((exam) => {
      const user = exam.user_id ? usersById.get(exam.user_id) : undefined
      return {
        ...exam,
        username: user?.username || "",
        full_name: user?.full_name || "",
        clientName,
      }
    })
  }, [clientName, examsQuery.data, usersById])
  const queryKey = clientQueryKeys.exams(clientIdNum, "exam")

  const handleExamDeleted = (deletedExamId: number) => {
    queryClient.setQueryData<OpticalExam[]>(queryKey, (current) =>
      removeQueryItemById(current, deletedExamId),
    )
  }

  const handleExamDeleteFailed = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  return (
    <ExamsTable 
      data={exams} 
      clientId={clientIdNum} 
      onExamDeleted={handleExamDeleted} 
      onExamDeleteFailed={handleExamDeleteFailed}
      loading={examsQuery.isLoading}
    />
  )
} 
