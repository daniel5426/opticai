import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAllFiles } from "@/lib/db/files-db"
import { File } from "@/lib/db/schema"
import { FilesTable } from "@/components/files-table"
import { useNavigate } from "@tanstack/react-router"

export default function AllFilesPage() {
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadFiles = async () => {
    try {
      setLoading(true)
      const filesData = await getAllFiles()
      setFiles(filesData)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
  }, [])

  const handleFileDeleted = (deletedFileId: number) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== deletedFileId))
  }

  const handleFileDeleteFailed = () => {
    loadFiles()
  }

  return (
    <>
      <SiteHeader title="קבצים" />
      <div 
        className="flex flex-col flex-1 p-4 lg:p-6 overflow-auto" 
        dir="rtl" 
        style={{scrollbarWidth: 'none'}}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">כל הקבצים</h1>
        </div>
        <FilesTable 
          data={files} 
          clientId={0} 
          onFileUploaded={loadFiles}
          onFileDeleted={handleFileDeleted}
          onFileDeleteFailed={handleFileDeleteFailed}
          loading={loading}
        />
      </div>
    </>
  )
} 