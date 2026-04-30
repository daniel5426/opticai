import React, { useState, useEffect } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedFiles } from "@/lib/db/files-db"
import { File } from "@/lib/db/schema-interface"
import { FilesTable } from "@/components/files-table"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"

export default function AllFilesPage() {
  const { currentClinic } = useUser()
  const search = useSearch({ from: "/files" })
  const navigate = useNavigate()
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState(search.q)
  const activeSort = React.useMemo(
    () => parseSortSearch(search.sort, { key: "upload_date", direction: "desc" }),
    [search.sort],
  )

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = (overrides?: Partial<{ q: string; page: number; fileCategory: string; sort: string }>) =>
    buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        fileCategory: search.fileCategory,
        sort: search.sort,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        fileCategory: ALL_FILTER_VALUE,
        sort: "",
      },
    )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/files",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [navigate, search.q, searchInput])

  const loadFiles = async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedFiles(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: sortToOrder(activeSort, "upload_date_desc"),
        q: search.q || undefined,
        fileCategory: search.fileCategory !== ALL_FILTER_VALUE ? search.fileCategory : undefined,
      })
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
  }, [activeSort, currentClinic, pageSize, search.fileCategory, search.page, search.q])

  const handleFileDeleted = (deletedFileId: number) => {
    setFiles(prevFiles => prevFiles.filter(file => file.id !== deletedFileId))
    // Move to previous page if we deleted the last item on the current page
    if (files.length === 1 && search.page > 1) {
      navigate({
        to: "/files",
        search: buildSearchState({ page: search.page - 1 }),
      })
    } else {
      setTotal(prev => prev - 1)
    }
  }

  const handleFileDeleteFailed = () => {
    loadFiles()
  }

  const handleFileUpdated = (updatedFile: File) => {
    setFiles(prevFiles => prevFiles.map(file => file.id === updatedFile.id ? updatedFile : file))
  }

  return (
    <>
      <SiteHeader title="מסמכים" />
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
          onFileUpdated={handleFileUpdated}
          onFileDeleted={handleFileDeleted}
          onFileDeleteFailed={handleFileDeleteFailed}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          fileCategoryFilter={search.fileCategory}
          onFileCategoryFilterChange={(value) =>
            navigate({
              to: "/files",
              search: buildSearchState({ fileCategory: value, page: 1 }),
            })
          }
          sort={activeSort}
          onSortChange={(sort) =>
            navigate({
              to: "/files",
              search: buildSearchState({ sort: sortToSearch(sort), page: 1 }),
            })
          }
          loading={loading}
          pagination={{
            page: search.page,
            pageSize,
            total,
            setPage: (page) =>
              navigate({
                to: "/files",
                search: buildSearchState({ page }),
              }),
          }}
        />
      </div>
    </>
  )
} 
