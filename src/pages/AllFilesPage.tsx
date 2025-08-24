import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedFiles } from "@/lib/db/files-db"
import { File } from "@/lib/db/schema-interface"
import { FilesTable } from "@/components/files-table"
import { useNavigate } from "@tanstack/react-router"
import { useUser } from "@/contexts/UserContext"

export default function AllFilesPage() {
  const { currentClinic } = useUser()
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()

  const loadFiles = async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const { items, total } = await getPaginatedFiles(currentClinic?.id, { limit: pageSize, offset, order: 'upload_date_desc' })
      setFiles(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading files:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentClinic) {
      loadFiles()
    }
  }, [currentClinic, page, pageSize])

  const handleFileDeleted = (deletedFileId: number) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== deletedFileId))
    // Move to previous page if we deleted the last item on the current page
    if (files.length === 1 && page > 1) {
      setPage(page - 1)
    } else {
      setTotal(prev => prev - 1)
    }
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
          <h1 className="text-xl font-bold">כל הקבצים</h1>
        </div>
        <FilesTable 
          data={files} 
          clientId={0} 
          onFileUploaded={loadFiles}
          onFileDeleted={handleFileDeleted}
          onFileDeleteFailed={handleFileDeleteFailed}
          loading={loading}
          pagination={{ page, pageSize, total, setPage }}
        />
      </div>
    </>
  )
} 