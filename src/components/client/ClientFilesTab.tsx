import React, { useState, useEffect } from "react"
import { FilesTable } from "@/components/files-table"
import { getFilesByClientId } from "@/lib/db/files-db"
import { useParams } from "@tanstack/react-router"
import { File } from "@/lib/db/schema"

export function ClientFilesTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)

  const loadFiles = async () => {
    try {
      setLoading(true)
      const filesData = await getFilesByClientId(Number(clientId))
      setFiles(filesData)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-lg">טוען קבצים...</div>
      </div>
    )
  }

  return (
    <FilesTable 
      data={files} 
      clientId={Number(clientId)} 
      onFileUploaded={loadFiles}
    />
  )
} 