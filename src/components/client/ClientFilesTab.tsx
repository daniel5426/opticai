import React from "react"
import { FilesTable } from "@/components/files-table"
import { useParams } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  clientQueryKeys,
  removeQueryItemById,
  replaceQueryItemById,
  useClientFilesQuery,
} from "@/hooks/client/useClientTabQueries"
import { File } from "@/lib/db/schema-interface"

interface ClientFilesTabProps {
  enabled?: boolean
}

export function ClientFilesTab({ enabled = true }: ClientFilesTabProps) {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const clientIdNum = Number(clientId)
  const queryClient = useQueryClient()
  const filesQuery = useClientFilesQuery(clientIdNum, enabled)
  const queryKey = clientQueryKeys.files(clientIdNum)

  const handleFileDeleted = (deletedFileId: number) => {
    queryClient.setQueryData<File[]>(queryKey, (current) =>
      removeQueryItemById(current, deletedFileId),
    )
  }

  const handleFileDeleteFailed = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  const handleFileUpdated = (file: File) => {
    queryClient.setQueryData<File[]>(queryKey, (current) =>
      replaceQueryItemById(current, file),
    )
  }

  return (
    <FilesTable 
      data={filesQuery.data || []} 
      clientId={clientIdNum} 
      onFileUploaded={() => queryClient.invalidateQueries({ queryKey })}
      onFileUpdated={handleFileUpdated}
      onFileDeleted={handleFileDeleted}
      onFileDeleteFailed={handleFileDeleteFailed}
      loading={filesQuery.isLoading}
    />
  )
} 
