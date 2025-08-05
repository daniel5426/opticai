import React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, File, FileText, FileImage, FileVideo, FileAudio, Upload, Download, Trash2 } from "lucide-react"
import { File as FileType, User, Client } from "@/lib/db/schema-interface"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { getAllUsers } from "@/lib/db/users-db"
import { getAllClients } from "@/lib/db/clients-db"
import { deleteFile, createFile } from "@/lib/db/files-db"
import { toast } from "sonner"
import { CustomModal } from "@/components/ui/custom-modal"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/contexts/UserContext"

interface FilesTableProps {
  data: FileType[]
  clientId: number
  onFileDeleted: (fileId: number) => void
  onFileDeleteFailed: () => void
  onFileUploaded?: () => void
  onClientSelectForUpload?: (files: FileList, clientId: number) => void
  loading: boolean
}

export function FilesTable({ data, clientId, onFileDeleted, onFileDeleteFailed, onFileUploaded, onClientSelectForUpload, loading }: FilesTableProps) {
  const { currentClinic } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showClientSelect, setShowClientSelect] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileType | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!currentClinic) return
      
      try {
        const [usersData, clientsData] = await Promise.all([
          getAllUsers(currentClinic.id),
          getAllClients(currentClinic.id)
        ])
        setUsers(usersData)
        setClients(clientsData)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    loadData()
  }, [currentClinic])

  const getUserName = (userId?: number): string => {
    if (!userId) return ''
    const user = users.find(u => u.id === userId)
    return user?.username || ''
  }

  const getClientName = (clientId: number): string => {
    const client = clients.find(c => c.id === clientId)
    return client ? `${client.first_name} ${client.last_name}`.trim() : ''
  }

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return <File className="h-4 w-4" />
    
    if (fileType.startsWith('image/')) return <FileImage className="h-4 w-4" />
    if (fileType.startsWith('video/')) return <FileVideo className="h-4 w-4" />
    if (fileType.startsWith('audio/')) return <FileAudio className="h-4 w-4" />
    if (fileType.includes('text') || fileType.includes('document')) return <FileText className="h-4 w-4" />
    
    return <File className="h-4 w-4" />
  }

  const getSimpleFileType = (mimeType?: string): string => {
    if (!mimeType) return 'קובץ'
    
    if (mimeType.startsWith('image/')) return 'תמונה'
    if (mimeType.startsWith('video/')) return 'וידאו'
    if (mimeType.startsWith('audio/')) return 'אודיו'
    if (mimeType.includes('pdf')) return 'PDF'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Word'
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Excel'
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'PowerPoint'
    if (mimeType.includes('text')) return 'טקסט'
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'ארכיון'
    
    return 'קובץ'
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDeleteConfirm = async () => {
    if (fileToDelete && fileToDelete.id !== undefined) {
      try {
        const deletedFileId = fileToDelete.id;
        onFileDeleted(deletedFileId);
        toast.success("הקובץ נמחק בהצלחה");

        const success = await deleteFile(deletedFileId);
        if (!success) {
          toast.error("שגיאה במחיקת הקובץ. מרענן נתונים...");
          onFileDeleteFailed();
        }
      } catch (error) {
        console.error('Error deleting file:', error);
        toast.error("שגיאה במחיקת הקובץ");
        onFileDeleteFailed();
      } finally {
        setFileToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  }

  const handleDownload = (file: FileType) => {
    if (file.file_path) {
      const link = document.createElement('a')
      link.href = file.file_path
      link.download = file.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleFileUpload = async (files: FileList, targetClientId: number) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`קובץ "${file.name}" גדול מדי (מעל 10MB)`)
          continue
        }

        const fileUrl = URL.createObjectURL(file)
        
        const fileData = {
          client_id: targetClientId,
          clinic_id: currentClinic?.id,
          file_name: file.name,
          file_path: fileUrl,
          file_size: file.size,
          file_type: file.type,
          uploaded_by: 1,
          notes: ''
        }

        const result = await createFile(fileData)
        if (result) {
          toast.success(`קובץ "${file.name}" הועלה בהצלחה`)
        } else {
          toast.error(`שגיאה בהעלאת קובץ "${file.name}"`)
        }
      }
      
      onFileUploaded?.()
    } catch (error) {
      console.error('Error uploading files:', error)
      toast.error("שגיאה בהעלאת קבצים")
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      if (clientId > 0) {
        handleFileUpload(files, clientId)
      } else {
        setPendingFiles(files)
        setShowClientSelect(true)
      }
    }
  }, [clientId])

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      // Create a copy of the FileList to avoid it becoming stale
      const fileArray = Array.from(files)
      const fileListCopy = {
        ...files,
        length: fileArray.length,
        item: (index: number) => fileArray[index] || null,
        [Symbol.iterator]: function* () {
          for (const file of fileArray) {
            yield file
          }
        }
      } as FileList

      if (clientId > 0) {
        handleFileUpload(fileListCopy, clientId)
        // Reset input after upload for client-specific pages
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        setPendingFiles(fileListCopy)
        setShowClientSelect(true)
        // Don't reset input here - it will be reset after client selection
      }
    }
  }

  const handleClientSelectForFiles = (selectedClientId: number) => {
    if (pendingFiles) {
      handleFileUpload(pendingFiles, selectedClientId)
      setPendingFiles(null)
    }
    setShowClientSelect(false)
    // Reset input after client selection and upload
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const filteredData = data.filter((file) => {
    const searchableFields = [
      file.file_name || '',
      file.file_type || '',
      file.upload_date || '',
      getUserName(file.uploaded_by),
      getClientName(file.client_id),
      file.notes || ''
    ]

    return searchableFields.some(
      (field) => field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div 
      className="relative space-y-4 min-h-[60vh]" 
      style={{scrollbarWidth: 'none'}}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 flex items-center justify-center z-10 rounded-md">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
            <Upload className="h-16 w-16 mx-auto mb-4 text-blue-500" />
            <p className="text-2xl font-medium">שחרר כדי להעלות קבצים</p>
            {clientId === 0 && <p className="text-lg text-muted-foreground mt-2">תתבקש לבחור לקוח</p>}
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center" dir="rtl">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש קבצים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px] bg-card dark:bg-card" dir="rtl"
          />
        </div>
        <Button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? 'מעלה...' : 'העלאת קובץ'}
          <Upload className="h-4 w-4 mr-2" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFileInputChange}
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-[50px]"></TableHead>
              <TableHead className="text-right">שם הקובץ</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              <TableHead className="text-right">גודל</TableHead>
              <TableHead className="text-right">תאריך העלאה</TableHead>
              <TableHead className="text-right">הועלה על ידי</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                </TableRow>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((file) => (
                <TableRow key={file.id}>
                  <TableCell>{getFileIcon(file.file_type)}</TableCell>
                  <TableCell className="font-medium">{file.file_name}</TableCell>
                  <TableCell>{getSimpleFileType(file.file_type)}</TableCell>
                  <TableCell>{formatFileSize(file.file_size)}</TableCell>
                  <TableCell>{file.upload_date ? new Date(file.upload_date).toLocaleDateString('he-IL') : ''}</TableCell>
                  <TableCell>{getUserName(file.uploaded_by)}</TableCell>
                  {clientId === 0 && (
                    <TableCell>
                      <button
                        onClick={() => navigate({
                          to: "/clients/$clientId",
                          params: { clientId: String(file.client_id) },
                          search: { tab: 'files' }
                        })}
                        className="text-blue-600 hover:underline"
                      >
                        {getClientName(file.client_id)}
                      </button>
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDownload(file)}
                        title="הורדה"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setFileToDelete(file)
                          setIsDeleteModalOpen(true)
                        }}
                        title="מחיקה"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  לא נמצאו קבצים.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      <ClientSelectModal
        triggerText=""
        onClientSelect={handleClientSelectForFiles}
        isOpen={showClientSelect}
        onClose={() => {
          setShowClientSelect(false)
          setPendingFiles(null)
        }}
      />

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת קובץ"
        description={fileToDelete ? `האם אתה בטוח שברצונך למחוק את הקובץ "${fileToDelete.file_name}"?` : "האם אתה בטוח שברצונך למחוק את הקובץ?"}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />
    </div>
  )
} 