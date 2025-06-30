import React from "react"
import { FilesTable } from "@/components/files-table"
import { useParams } from "@tanstack/react-router"
import { useClientData } from "@/contexts/ClientDataContext"
import { File } from "@/lib/db/schema"

export function ClientFilesTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { files, loading, refreshFiles } = useClientData()
  const [currentFiles, setCurrentFiles] = React.useState<File[]>(files)

  React.useEffect(() => {
    setCurrentFiles(files)
  }, [files])

  const handleFileDeleted = (deletedFileId: number) => {
    setCurrentFiles(prevFiles => prevFiles.filter(file => file.id !== deletedFileId))
  }

  const handleFileDeleteFailed = () => {
    refreshFiles()
  }


  return (
    <FilesTable 
      data={currentFiles} 
      clientId={Number(clientId)} 
      onFileUploaded={refreshFiles}
      onFileDeleted={handleFileDeleted}
      onFileDeleteFailed={handleFileDeleteFailed}
      loading={loading.files}
    />
  )
} 