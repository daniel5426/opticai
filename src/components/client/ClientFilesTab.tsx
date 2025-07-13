import React from "react"
import { FilesTable } from "@/components/files-table"
import { useParams } from "@tanstack/react-router"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientFilesTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { files, loading, removeFile, refreshFiles } = useClientData()

  const handleFileDeleted = (deletedFileId: number) => {
    removeFile(deletedFileId)
  }

  const handleFileDeleteFailed = () => {
    refreshFiles()
  }

  return (
    <FilesTable 
      data={files} 
      clientId={Number(clientId)} 
      onFileUploaded={refreshFiles}
      onFileDeleted={handleFileDeleted}
      onFileDeleteFailed={handleFileDeleteFailed}
      loading={loading.files}
    />
  )
} 